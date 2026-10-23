import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {getPool} from "../../apps/merchant/lib/mysql";
import {persistPayment,merchantPayments} from "../../apps/merchant/lib/payments";
import {buildPayment} from "../../functions/src/domain";
test("실제 MySQL: 중복·내용 충돌·판매자 분리",{skip:process.env.RUN_MYSQL_INTEGRATION!=="true"},async()=>{
  // Only run against an isolated test database. Do not use production credentials.
  assert.match(process.env.MYSQL_DATABASE||"",/_test$/);
  const pool=getPool();const merchantId=`test-${Date.now()}`;
  const p={...buildPayment(merchantId,{productId:"starter",quantity:1,requestId:crypto.randomUUID()}),merchantId};
  try{await pool.query(await readFile(new URL("../../database/001-payments.sql",import.meta.url),"utf8"));
    await Promise.all([persistPayment(pool,p),persistPayment(pool,p)]);
    const d=await merchantPayments(pool,merchantId);assert.equal(Number(d.totals.count),1);assert.equal(Number(d.totals.revenue),12000);
    await assert.rejects(persistPayment(pool,{...p,amount:24000}),/PAYMENT_CONFLICT/);
    assert.equal(Number((await merchantPayments(pool,`${merchantId}-other`)).totals.count),0);
  }finally{await pool.execute("DELETE FROM payments WHERE merchant_id=?",[merchantId]);await pool.end();}
});
