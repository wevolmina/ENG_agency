import type {Pool, RowDataPacket} from "mysql2/promise";
import {createHash} from "node:crypto";
import type {Payment} from "../../../functions/src/domain";
export function payloadHash(p:Payment) {
  return createHash("sha256").update(JSON.stringify([p.paymentId,p.orderId,p.customerId,p.merchantId,p.productId,p.productName,p.quantity,p.amount,p.currency,p.status,p.createdAt])).digest("hex");
}
export async function persistPayment(pool:Pool, p:Payment) {
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`INSERT INTO payments
      (payment_id,order_id,customer_id,merchant_id,product_id,product_name,quantity,amount,currency,status,created_at,payload_hash)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE payment_id=payment_id`,
      [p.paymentId,p.orderId,p.customerId,p.merchantId,p.productId,p.productName,p.quantity,p.amount,p.currency,p.status,p.createdAt.slice(0,23).replace("T"," "),payloadHash(p)]);
    const [rows]=await connection.execute<RowDataPacket[]>("SELECT payload_hash FROM payments WHERE payment_id=? FOR UPDATE",[p.paymentId]);
    if(rows[0]?.payload_hash!==payloadHash(p)) throw new Error("PAYMENT_CONFLICT");
    await connection.commit();
  } catch(error) {await connection.rollback();throw error;}
  finally {connection.release();}
}
export async function merchantPayments(pool:Pool,merchantId:string) {
  const [totals]=await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue, COALESCE(AVG(amount),0) AS average FROM payments WHERE merchant_id=? AND status='MOCK_APPROVED'",[merchantId]);
  const [daily]=await pool.execute<RowDataPacket[]>("SELECT DATE(DATE_ADD(created_at,INTERVAL 9 HOUR)) AS day,SUM(amount) AS revenue,COUNT(*) AS count FROM payments WHERE merchant_id=? AND status='MOCK_APPROVED' AND created_at>=UTC_DATE()-INTERVAL 29 DAY GROUP BY day ORDER BY day",[merchantId]);
  const [payments]=await pool.execute<RowDataPacket[]>("SELECT payment_id,order_id,product_name,quantity,amount,status,created_at,synced_at FROM payments WHERE merchant_id=? ORDER BY created_at DESC,payment_id DESC LIMIT 100",[merchantId]);
  return {merchantId,totals:totals[0],daily,payments,asOf:new Date().toISOString()};
}
