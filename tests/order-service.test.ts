import test from "node:test";
import assert from "node:assert/strict";
import {orderService,orderTask,type OrderTask,type IntakeStore} from "../apps/merchant/lib/order-service";
import {buildCart} from "../apps/merchant/lib/cart";
import {cronAuthorized} from "../apps/merchant/lib/cron-auth";
const input={requestId:"3fb030ea-9a5b-420b-a8d7-bb4a792fd7c1",items:[{productId:"bedroom-lighting" as const,quantity:1 as const}]};
function fixture(){
 const tasks=new Map<string,OrderTask>(),receipts=new Map<string,ReturnType<typeof buildCart>>();
 let failSql=false,failAck=false,failIntake=false,writes=0;
 const store:IntakeStore={
  prepare:async task=>{
   if(failIntake)throw Error("INTAKE_DOWN");
   const old=tasks.get(task.id);
   if(old&&(old.uid!==task.uid||old.kind!==task.kind||old.hash!==task.hash))throw Error("REQUEST_CONFLICT");
   if(!old)tasks.set(task.id,structuredClone(task));
   return structuredClone(tasks.get(task.id)!);
  },
  finish:async(id,receipt)=>{if(failAck)throw Error("FIRESTORE_DOWN");Object.assign(tasks.get(id)!,{state:"synced",receipt})},
  fail:async(id,lastError,blocked)=>{const task=tasks.get(id)!;if(task.state!=="synced")Object.assign(task,{state:blocked?"blocked":"pending",lastError,attempts:task.attempts+1})},
  due:async limit=>[...tasks.values()].filter(task=>task.state==="pending").slice(0,limit),
 };
 const service=orderService(store,async task=>{
  if(failSql)throw Error("SQL_DOWN");
  let receipt=receipts.get(task.id);if(!receipt){receipt=buildCart(task.uid,task.input as typeof input);receipts.set(task.id,receipt);writes++}
  return receipt;
 });
 return {service,tasks,receipts,get writes(){return writes},set failSql(v:boolean){failSql=v},set failAck(v:boolean){failAck=v},set failIntake(v:boolean){failIntake=v}};
}
test("failed durable intake never writes a seller order",async()=>{
 const f=fixture();f.failIntake=true;
 await assert.rejects(f.service.submit(orderTask("owner","cart",input)),/INTAKE_DOWN/);assert.equal(f.writes,0);
});
test("SQL failure remains pending and manual retry uses the same request",async()=>{
 const f=fixture(),task=orderTask("owner","cart",input);f.failSql=true;
 assert.equal((await f.service.submit(task)).status,202);assert.equal(f.tasks.get(task.id)?.state,"pending");
 f.failSql=false;assert.equal((await f.service.submit(task)).status,200);assert.equal(f.writes,1);
 assert.equal((await f.service.submit(task)).status,200);assert.equal(f.writes,1);
});
test("SQL commit plus Firestore acknowledgement failure is recovered by daily retry",async()=>{
 const f=fixture(),task=orderTask("owner","cart",input);f.failAck=true;
 assert.equal((await f.service.submit(task)).status,202);assert.equal(f.writes,1);
 f.failAck=false;assert.deepEqual(await f.service.reconcile(),{checked:1,completed:1,pending:0,blocked:0});
 assert.equal(f.writes,1);assert.equal(f.tasks.get(task.id)?.state,"synced");
});
test("same request with changed items conflicts; another owner has a separate order",async()=>{
 const f=fixture();await f.service.submit(orderTask("owner","cart",input));
 await assert.rejects(f.service.submit(orderTask("owner","cart",{...input,items:[{productId:"desk-focus",quantity:1}]})),/REQUEST_CONFLICT/);
 await f.service.submit(orderTask("another","cart",input));assert.equal(f.writes,2);
});
test("concurrent retries produce the same receipt without duplicate writes",async()=>{
 const f=fixture(),task=orderTask("owner","cart",input);
 const results=await Promise.all(Array.from({length:5},()=>f.service.submit(task)));
 assert(results.every(r=>r.status===200));assert.equal(f.writes,1);
});
test("cron requires a configured secret and an exact bearer header",()=>{
 const secret="fixture-only-".repeat(4);
 assert(!cronAuthorized(new Request("https://example.invalid"),""));
 assert(!cronAuthorized(new Request("https://example.invalid",{headers:{authorization:"Bearer wrong"}}),secret));
 assert(cronAuthorized(new Request("https://example.invalid",{headers:{authorization:"Bearer "+secret}}),secret));
});
