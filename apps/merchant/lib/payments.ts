import type {Pool, RowDataPacket} from "./db";
import {createHash} from "node:crypto";
import type {Payment} from "../../../functions/src/domain";
export function payloadHash(p:Omit<Payment,"productId">&{productId:string}) {
  return createHash("sha256").update(JSON.stringify([p.paymentId,p.orderId,p.customerId,p.merchantId,p.productId,p.productName,p.quantity,p.amount,p.currency,p.status,p.createdAt])).digest("hex");
}
export async function persistPayment(pool:Pool, p:Payment) {
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`INSERT INTO payments
      (payment_id,order_id,customer_id,merchant_id,product_id,product_name,quantity,amount,currency,status,created_at,payload_hash)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
      [p.paymentId,p.orderId,p.customerId,p.merchantId,p.productId,p.productName,p.quantity,p.amount,p.currency,p.status,p.createdAt.slice(0,23).replace("T"," "),payloadHash(p)]);
    const [rows]=await connection.execute<RowDataPacket[]>("SELECT payload_hash FROM payments WHERE payment_id=? FOR UPDATE",[p.paymentId]);
    if(rows[0]?.payload_hash!==payloadHash(p)) throw new Error("PAYMENT_CONFLICT");
    await connection.commit();
  } catch(error) {await connection.rollback();throw error;}
  finally {connection.release();}
}
export async function merchantPayments(pool:Pool,merchantId:string) {
  const [totals]=await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue, COALESCE(AVG(amount),0) AS average FROM payments WHERE merchant_id=? AND status='MOCK_APPROVED'",[merchantId]);
  const [daily]=await pool.execute<RowDataPacket[]>("SELECT (created_at + INTERVAL '9 hours')::date AS day,SUM(amount) AS revenue,COUNT(*) AS count FROM payments WHERE merchant_id=? AND status='MOCK_APPROVED' AND created_at>=date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC' + INTERVAL '9 hours') - INTERVAL '29 days' - INTERVAL '9 hours' GROUP BY day ORDER BY day",[merchantId]);
  const [payments]=await pool.execute<RowDataPacket[]>(`SELECT payment_id,order_id,product_name,quantity,amount,status,created_at,synced_at,
    (SELECT json_agg(json_build_object('productId',i.product_id,'productName',i.product_name,'unitPrice',i.unit_price,'quantity',i.quantity,'lineTotal',i.unit_price*i.quantity)) FROM order_items i WHERE i.order_id=payments.order_id) AS items
    FROM payments WHERE merchant_id=? ORDER BY created_at DESC,payment_id DESC LIMIT 100`,[merchantId]);
  return {merchantId,totals:totals[0],daily,payments:payments.map(p=>({...p,items:(typeof p.items==="string"?JSON.parse(p.items):p.items)||[]})),asOf:new Date().toISOString()};
}
