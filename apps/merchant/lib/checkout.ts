import {createHash} from "node:crypto";
import type {Pool,RowDataPacket} from "mysql2/promise";
import {buildPayment,createInput,type Payment} from "../../../functions/src/domain";
import {payloadHash} from "./payments";
export type OrderInput=ReturnType<typeof createInput.parse>;
export function requestHash(input:OrderInput){return createHash("sha256").update(JSON.stringify([input.productId,input.quantity])).digest("hex");}
function receipt(row:RowDataPacket):Payment {
 return {paymentId:row.payment_id,orderId:row.order_id,customerId:row.customer_id,merchantId:row.merchant_id,productId:row.product_id,productName:row.product_name,quantity:row.quantity,amount:Number(row.amount),currency:row.currency,status:row.status,createdAt:new Date(String(row.created_at).replace(" ","T")+"Z").toISOString()};
}
export async function existingOrder(pool:Pool,uid:string,input:OrderInput){
 const [rows]=await pool.execute<RowDataPacket[]>("SELECT p.*,o.request_hash FROM orders o JOIN payments p ON p.order_id=o.order_id WHERE o.customer_id=? AND o.request_id=?",[uid,input.requestId]);
 if(!rows.length)return null;
 if(rows[0].request_hash!==requestHash(input))throw new Error("REQUEST_CONFLICT");
 return receipt(rows[0]);
}
export async function customerReceipt(pool:Pool,uid:string,id:string){
 const [rows]=await pool.execute<RowDataPacket[]>("SELECT * FROM payments WHERE payment_id=? AND BINARY customer_id=BINARY ?",[id,uid]);
 return rows.length?receipt(rows[0]):null;
}
export async function confirmOrder(pool:Pool,uid:string,input:OrderInput){
 const p=buildPayment(uid,input),hash=requestHash(input),time=p.createdAt.slice(0,23).replace("T"," ");
 const c=await pool.getConnection();
 try {
  await c.beginTransaction();
  await c.execute("INSERT INTO orders (order_id,customer_id,request_id,request_hash,merchant_id,amount,currency,status,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE order_id=order_id",[p.orderId,uid,input.requestId,hash,p.merchantId,p.amount,p.currency,p.status,time]);
  const [orders]=await c.execute<RowDataPacket[]>("SELECT request_hash FROM orders WHERE order_id=? FOR UPDATE",[p.orderId]);
  if(orders[0]?.request_hash!==hash)throw new Error("REQUEST_CONFLICT");
  const [old]=await c.execute<RowDataPacket[]>("SELECT * FROM payments WHERE payment_id=?",[p.paymentId]);
  if(old.length){await c.commit();return receipt(old[0]);}
  await c.execute("INSERT INTO order_items (order_id,line_number,product_id,product_name,unit_price,quantity) VALUES (?,1,?,?,?,?)",[p.orderId,p.productId,p.productName,p.amount/p.quantity,p.quantity]);
  await c.execute("INSERT INTO payments (payment_id,order_id,customer_id,merchant_id,product_id,product_name,quantity,amount,currency,status,created_at,payload_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",[p.paymentId,p.orderId,uid,p.merchantId,p.productId,p.productName,p.quantity,p.amount,p.currency,p.status,time,payloadHash(p)]);
  await c.commit();return p;
 }catch(error){await c.rollback();throw error;}finally{c.release();}
}
export async function recordRequest(token:string,uid:string,input:OrderInput){
 const project=process.env.FIREBASE_PROJECT_ID;if(!project)throw new Error("FIREBASE_CONFIG_MISSING");
 const id=buildPayment(uid,input).orderId;
 const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/order_requests/${id}`;
 const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
 const body={fields:{customerId:{stringValue:uid},requestId:{stringValue:input.requestId},productId:{stringValue:input.productId},quantity:{integerValue:String(input.quantity)}}};
 const result=await fetch(url+"?currentDocument.exists=false",{method:"PATCH",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000),cache:"no-store"});
 if(result.ok)return;
 // A create precondition failure is an idempotent retry only if all input matches.
 {
  const prior=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(prior.ok){const {fields}=await prior.json();if(fields.customerId?.stringValue===uid&&fields.requestId?.stringValue===input.requestId&&fields.productId?.stringValue===input.productId&&fields.quantity?.integerValue===String(input.quantity))return;throw new Error("REQUEST_CONFLICT");}
 }
 throw new Error("INTAKE_UNAVAILABLE");
}
