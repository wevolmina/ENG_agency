import {createHash} from "node:crypto";
import {z} from "zod";
import type {Pool,RowDataPacket} from "./db";
import {catalog} from "../../../functions/src/domain";
import {storedReceipt,type StoredReceipt} from "./checkout";
import {payloadHash} from "./payments";

export const cartLine=z.object({productId:z.enum(["bedroom-lighting","kitchen-sensing","desk-focus"]),quantity:z.literal(1)}).strict();
export const cartInput=z.object({items:z.array(cartLine).min(1).max(3).refine(items=>new Set(items.map(i=>i.productId)).size===items.length,"Duplicate package"),requestId:z.string().uuid()}).strict();
export type CartInput=z.infer<typeof cartInput>;
export function canonicalItems(input:CartInput){return [...input.items].sort((a,b)=>a.productId<b.productId?-1:a.productId>b.productId?1:0)}
export function cartHash(input:CartInput){return createHash("sha256").update(JSON.stringify(["space-cart-v1",canonicalItems(input).map(i=>[i.productId,i.quantity])])).digest("hex")}
export function buildCart(uid:string,input:CartInput,now=new Date()):StoredReceipt{
 const items=canonicalItems(input).map(i=>({productId:i.productId,productName:catalog[i.productId].name,unitPrice:catalog[i.productId].amount,quantity:1,lineTotal:catalog[i.productId].amount}));
 const key=createHash("sha256").update(`${uid}:${input.requestId}`).digest("hex").slice(0,40);
 return {paymentId:`pay_${key}`,orderId:`ord_${key}`,customerId:uid,merchantId:"studio-mina",productId:items.length===1?items[0].productId:"space-cart",productName:items.length===1?items[0].productName:`공간 패키지 ${items.length}종`,quantity:items.length,amount:items.reduce((n,i)=>n+i.lineTotal,0),currency:"KRW",status:"MOCK_APPROVED",createdAt:now.toISOString(),items};
}
export async function existingCart(pool:Pool,uid:string,input:CartInput){
 const [rows]=await pool.execute<RowDataPacket[]>("SELECT p.*,o.request_hash FROM orders o JOIN payments p ON p.order_id=o.order_id WHERE o.customer_id=? AND o.request_id=?",[uid,input.requestId]);
 if(!rows.length)return null;if(rows[0].request_hash!==cartHash(input))throw Error("REQUEST_CONFLICT");return storedReceipt(pool,rows[0]);
}
export async function confirmCart(pool:Pool,uid:string,input:CartInput){
 const p=buildCart(uid,input),hash=cartHash(input),time=p.createdAt.slice(0,23).replace("T"," "),c=await pool.getConnection();
 try{
  await c.beginTransaction();
  await c.execute("INSERT INTO orders (order_id,customer_id,request_id,request_hash,merchant_id,amount,currency,status,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",[p.orderId,uid,input.requestId,hash,p.merchantId,p.amount,p.currency,p.status,time]);
  const [orders]=await c.execute<RowDataPacket[]>("SELECT request_hash FROM orders WHERE order_id=? FOR UPDATE",[p.orderId]);if(orders[0]?.request_hash!==hash)throw Error("REQUEST_CONFLICT");
  const [old]=await c.execute<RowDataPacket[]>("SELECT * FROM payments WHERE payment_id=?",[p.paymentId]);if(old.length){const prior=await storedReceipt(c,old[0]);await c.commit();return prior}
  for(const [index,item]of p.items.entries()){
   const [rows]=await c.execute<RowDataPacket[]>("SELECT name,unit_price,merchant_id,active FROM packages WHERE product_id=? FOR SHARE",[item.productId]);const product=rows[0];if(!product?.active)throw Error("PACKAGE_UNAVAILABLE");
   if(product.name!==item.productName||Number(product.unit_price)!==item.unitPrice||product.merchant_id!==p.merchantId)throw Error("PACKAGE_CHANGED");
   await c.execute("INSERT INTO order_items (order_id,line_number,product_id,product_name,unit_price,quantity) VALUES (?,?,?,?,?,?)",[p.orderId,index+1,item.productId,item.productName,item.unitPrice,1]);
  }
  await c.execute("INSERT INTO payments (payment_id,order_id,customer_id,merchant_id,product_id,product_name,quantity,amount,currency,status,created_at,payload_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",[p.paymentId,p.orderId,uid,p.merchantId,p.productId,p.productName,p.quantity,p.amount,p.currency,p.status,time,payloadHash(p)]);
  await c.commit();return p;
 }catch(e){await c.rollback();throw e}finally{c.release()}
}
export async function recordCartRequest(token:string,uid:string,input:CartInput){
 const project=process.env.FIREBASE_PROJECT_ID;if(!project)throw Error("FIREBASE_CONFIG_MISSING");const id=buildCart(uid,input).orderId;
 const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/smartspace_cart_requests/${id}`,headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
 const items=canonicalItems(input),body={fields:{customerId:{stringValue:uid},requestId:{stringValue:input.requestId},items:{arrayValue:{values:items.map(i=>({mapValue:{fields:{productId:{stringValue:i.productId},quantity:{integerValue:"1"}}}}))}}}};
 const r=await fetch(url+"?currentDocument.exists=false",{method:"PATCH",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000),cache:"no-store"});if(r.ok)return;
 const prior=await fetch(url,{headers,signal:AbortSignal.timeout(10000),cache:"no-store"});if(prior.ok){const {fields}=await prior.json();const old=(fields.items?.arrayValue?.values||[]).map((v:{mapValue?:{fields?:{productId?:{stringValue?:string};quantity?:{integerValue?:string}}}})=>({productId:v.mapValue?.fields?.productId?.stringValue,quantity:Number(v.mapValue?.fields?.quantity?.integerValue)}));if(fields.customerId?.stringValue===uid&&fields.requestId?.stringValue===input.requestId&&JSON.stringify(old)===JSON.stringify(items))return;throw Error("REQUEST_CONFLICT")}
 throw Error("INTAKE_UNAVAILABLE");
}
