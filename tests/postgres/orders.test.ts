import test from "node:test";
import assert from "node:assert/strict";
import {getPool,type Pool} from "../../apps/merchant/lib/db";
import {confirmCart,existingCart} from "../../apps/merchant/lib/cart";
import {confirmOrder,customerReceipt} from "../../apps/merchant/lib/checkout";
import {merchantPayments} from "../../apps/merchant/lib/payments";
import {spaceCatalog,setPackageActive} from "../../apps/merchant/lib/catalog";
import {bootstrapMaster,applyForAccess,reviewApplication,ownApplications,type AccessIdentity} from "../../apps/merchant/lib/staff-access";
test("PostgreSQL: concurrent orders, rollback, privacy, catalogue and staff approval",{skip:process.env.RUN_POSTGRES_TESTS!=="true"},async()=>{
 const pool=getPool(),uid="fixture-"+crypto.randomUUID();
 try{
  const catalog=await spaceCatalog(pool);assert.equal(catalog.length,3);assert.equal(catalog[0].spaceName.length>0,true);
  const input={requestId:crypto.randomUUID(),items:[{productId:"bedroom-lighting" as const,quantity:1 as const},{productId:"desk-focus" as const,quantity:1 as const}]};
  const [a,b]=await Promise.all([confirmCart(pool,uid,input),confirmCart(pool,uid,input)]);
  assert.equal(a.paymentId,b.paymentId);assert.equal(b.createdAt,a.createdAt);assert.equal(a.amount,178000);
  assert.equal((await customerReceipt(pool,uid,a.paymentId))?.items.length,2);
  assert.equal(await customerReceipt(pool,uid+"other",a.paymentId),null);
  await assert.rejects(confirmCart(pool,uid,{...input,items:input.items.slice(0,1)}),/REQUEST_CONFLICT/);
  const broken={getConnection:async()=>{const connection=await pool.getConnection();return new Proxy(connection,{get(target,key){
   if(key==="execute")return async(sql:string,args:unknown[])=>{if(sql.startsWith("INSERT INTO payments"))throw Error("INJECTED");return target.execute(sql,args)};
   const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;
  }})}} as Pool;
  const retry={...input,requestId:crypto.randomUUID()};
  await assert.rejects(confirmCart(broken,uid,retry),/INJECTED/);
  assert.equal(await existingCart(pool,uid,retry),null);
  await confirmOrder(pool,uid,{requestId:crypto.randomUUID(),productId:"kitchen-sensing",quantity:1});
  const stats=await merchantPayments(pool,"studio-mina");
  assert.equal(Number(stats.totals.count),2);assert.equal(Number(stats.totals.revenue),277000);
  assert.equal(stats.payments.find(p=>p.payment_id===a.paymentId)?.items.length,2);
  assert(stats.daily.length>0);
  const now=Date.now(),master:AccessIdentity={uid:"master",email:"master@example.invalid",emailVerified:true,
   claims:{email:"master@example.invalid",email_verified:true,auth_time:Math.floor(now/1000),firebase:{sign_in_provider:"google.com"}}};
  await bootstrapMaster(pool,master,{password:"fixture-only-password",includeMerchant:true},
   {MASTER_SETUP_EMAIL:master.email!,MASTER_SETUP_MERCHANT_ID:"studio-mina",MASTER_SETUP_PASSWORD:"fixture-only-password"},now);
  const applicant={...master,uid:"applicant",email:"applicant@example.invalid"};
  const application=await applyForAccess(pool,applicant,"merchant",{email:applicant.email});
  assert.equal((await applyForAccess(pool,applicant,"merchant",{email:applicant.email})).requestId,application.requestId);
  await reviewApplication(pool,master,{requestId:application.requestId,decision:"approved",reason:"fixture"},now);
  assert.equal((await ownApplications(pool,applicant)).memberships[0].active,true);
  await setPackageActive(pool,"master","studio-mina","desk-focus",false,1);
  await assert.rejects(confirmCart(pool,uid,{...input,requestId:crypto.randomUUID()}),/PACKAGE_UNAVAILABLE/);
  assert.equal((await confirmCart(pool,uid,input)).paymentId,a.paymentId);
 }finally{await pool.end()}
});
