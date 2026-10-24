import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import type {Pool,RowDataPacket} from "mysql2/promise";
import {getPool} from "../../apps/merchant/lib/mysql";
import {confirmOrder,existingOrder,customerReceipt} from "../../apps/merchant/lib/checkout";
test("checkout transaction: parallel retry, conflict, receipt isolation, rollback",{skip:process.env.RUN_MYSQL_INTEGRATION!=="true"},async()=>{
 assert.match(process.env.MYSQL_DATABASE||"",/_test$/);
 const pool=getPool(),uid="checkout-"+crypto.randomUUID();
 const input={productId:"bedroom-lighting" as const,quantity:2,requestId:crypto.randomUUID()};
 try{
  for(const file of ["smartspace-v2.sql"]){for(const sql of (await readFile(new URL("../../database/"+file,import.meta.url),"utf8")).split(/;\s*(?:\n|$)/).filter(s=>s.trim()))await pool.query(sql);}
  const [a,b]=await Promise.all([confirmOrder(pool,uid,input),confirmOrder(pool,uid,input)]);
  assert.equal(a.paymentId,b.paymentId);assert.equal(a.createdAt,b.createdAt);assert.equal(a.amount,198000);
  assert.equal((await existingOrder(pool,uid,input))?.paymentId,a.paymentId);
  await assert.rejects(confirmOrder(pool,uid,{...input,quantity:3}),/REQUEST_CONFLICT/);
  assert.equal(await customerReceipt(pool,uid+"-other",a.paymentId),null);
  assert.equal((await customerReceipt(pool,uid,a.paymentId))?.amount,198000);
  // Disabling new sales must not prevent recovery of an already approved order.
  await pool.execute("UPDATE packages SET active=0 WHERE product_id=?",[input.productId]);
  assert.equal((await confirmOrder(pool,uid,input)).paymentId,a.paymentId);
  await assert.rejects(confirmOrder(pool,uid,{...input,requestId:crypto.randomUUID()}),/PACKAGE_UNAVAILABLE/);
  await pool.execute("UPDATE packages SET active=1 WHERE product_id=?",[input.productId]);
  for(const sql of (await readFile(new URL("../../database/003-kitchen-package.sql",import.meta.url),"utf8")).split(/;\s*(?:\n|$)/).filter(s=>s.trim()))await pool.query(sql);
  const kitchen={...input,productId:"kitchen-sensing" as const,quantity:1,requestId:crypto.randomUUID()};
  const [ka,kb]=await Promise.all([confirmOrder(pool,uid,kitchen),confirmOrder(pool,uid,kitchen)]);
  assert.equal(ka.orderId,kb.orderId);assert.equal(ka.amount,99000);assert.equal(ka.productName,"주방 센서 조명 패키지");
  await assert.rejects(confirmOrder(pool,uid,{...kitchen,productId:"bedroom-lighting"}),/REQUEST_CONFLICT/);
  assert.equal((await customerReceipt(pool,uid,ka.paymentId))?.productId,"kitchen-sensing");
  await pool.execute("UPDATE packages SET active=0 WHERE product_id=?",[kitchen.productId]);
  assert.equal((await confirmOrder(pool,uid,kitchen)).paymentId,ka.paymentId);
  await assert.rejects(confirmOrder(pool,uid,{...kitchen,requestId:crypto.randomUUID()}),/PACKAGE_UNAVAILABLE/);
  await pool.execute("UPDATE packages SET active=1 WHERE product_id=?",[kitchen.productId]);
  const connection=await pool.getConnection();connection.release();
  const faulty={getConnection:async()=>{const c=await pool.getConnection();return new Proxy(c,{get(target,key){if(key==="execute")return (sql:string,args:unknown[])=>{if(sql.startsWith("INSERT INTO payments"))throw new Error("INJECTED_FAILURE");return target.execute(sql,args);};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});}} as unknown as Pool;
  const failed={...input,requestId:crypto.randomUUID()};
  await assert.rejects(confirmOrder(faulty,uid,failed),/INJECTED_FAILURE/);
  const [rows]=await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM orders WHERE customer_id=?",[uid]);assert.equal(Number(rows[0].n),2);
  assert.equal(await existingOrder(pool,uid,failed),null);
 }finally{
  await pool.execute("DELETE i FROM order_items i JOIN orders o ON i.order_id=o.order_id WHERE o.customer_id=?",[uid]);
  await pool.execute("DELETE FROM payments WHERE BINARY customer_id=BINARY ?",[uid]);
  await pool.execute("DELETE FROM orders WHERE customer_id=?",[uid]);await pool.end();
 }
});
