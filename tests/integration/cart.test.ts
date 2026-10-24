import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import type {Pool,RowDataPacket} from "mysql2/promise";
import {getPool} from "../../apps/merchant/lib/mysql";
import {confirmCart,existingCart,type CartInput} from "../../apps/merchant/lib/cart";
import {confirmOrder,existingOrder,customerReceipt} from "../../apps/merchant/lib/checkout";
import {merchantPayments} from "../../apps/merchant/lib/payments";
test("cart atomicity, concurrency, receipt lines, privacy and legacy coexistence",{skip:process.env.RUN_CART_INTEGRATION!=="true"},async()=>{
 assert.match(process.env.MYSQL_DATABASE||'',/_test$/);const pool=getPool(),uid='cart-'+crypto.randomUUID();
 const input:CartInput={requestId:crypto.randomUUID(),items:[{productId:'bedroom-lighting',quantity:1},{productId:'kitchen-sensing',quantity:1},{productId:'desk-focus',quantity:1}]};
 try{
  for(const f of ['smartspace-v2.sql','003-kitchen-package.sql','004-desk-package.sql'])for(const sql of (await readFile(new URL('../../database/'+f,import.meta.url),'utf8')).split(/;\s*(?:\n|$)/).filter(s=>s.trim()))await pool.query(sql);
  const legacy={productId:'bedroom-lighting' as const,quantity:1,requestId:crypto.randomUUID()};const old=await confirmOrder(pool,uid,legacy);assert.equal((await existingOrder(pool,uid,legacy))?.paymentId,old.paymentId);
  const [a,b]=await Promise.all([confirmCart(pool,uid,input),confirmCart(pool,uid,{...input,items:[...input.items].reverse()})]);assert.equal(a.paymentId,b.paymentId);assert.equal(a.amount,277000);assert.equal(b.items.length,3);assert.equal((await existingCart(pool,uid,input))?.items.length,3);
  assert.equal(await customerReceipt(pool,uid+'-other',a.paymentId),null);assert.equal((await customerReceipt(pool,uid,a.paymentId))?.items.reduce((n,i)=>n+i.lineTotal,0),277000);
  await assert.rejects(confirmCart(pool,uid,{...input,items:input.items.slice(0,2)}),/REQUEST_CONFLICT/);await assert.rejects(existingOrder(pool,uid,{...legacy,requestId:input.requestId}),/REQUEST_CONFLICT/);
  await pool.execute("UPDATE packages SET active=0 WHERE product_id='desk-focus'");assert.equal((await confirmCart(pool,uid,input)).orderId,a.orderId);await assert.rejects(confirmCart(pool,uid,{...input,requestId:crypto.randomUUID()}),/PACKAGE_UNAVAILABLE/);await pool.execute("UPDATE packages SET active=1,unit_price=79001 WHERE product_id='desk-focus'");await assert.rejects(confirmCart(pool,uid,{...input,requestId:crypto.randomUUID()}),/PACKAGE_CHANGED/);await pool.execute("UPDATE packages SET unit_price=79000 WHERE product_id='desk-focus'");
  const faulty={getConnection:async()=>{const c=await pool.getConnection();return new Proxy(c,{get(target,key){if(key==='execute')return (sql:string,args:unknown[])=>{if(sql.startsWith('INSERT INTO payments'))throw Error('INJECTED_CART_FAILURE');return target.execute(sql,args)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})}} as unknown as Pool;
  const failed={...input,requestId:crypto.randomUUID()};await assert.rejects(confirmCart(faulty,uid,failed),/INJECTED_CART_FAILURE/);assert.equal(await existingCart(pool,uid,failed),null);
  const [counts]=await pool.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM orders WHERE customer_id=?',[uid]);assert.equal(Number(counts[0].n),2);const [items]=await pool.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM order_items i JOIN orders o ON o.order_id=i.order_id WHERE o.customer_id=?',[uid]);assert.equal(Number(items[0].n),4);
  const staff=await merchantPayments(pool,'studio-mina'),row=staff.payments.find(p=>p.order_id===a.orderId);assert.equal(row?.items.length,3);assert.equal(Number(staff.totals.revenue),376000);
 }finally{await pool.end()}
});
