import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {initializeTestEnvironment,assertFails} from "@firebase/rules-unit-testing";
import {doc,getDoc,setDoc} from "firebase/firestore";
import {firestoreIntake} from "../../apps/merchant/lib/order-intake";
import {orderTask} from "../../apps/merchant/lib/order-service";
import {buildCart} from "../../apps/merchant/lib/cart";
test("Firestore intake transaction, ownership conflict, server-only access and acknowledgement precedence",async()=>{
 const projectId=process.env.FIREBASE_PROJECT_ID!;
 assert.equal(projectId,"demo-eng-agency");
 const environment=await initializeTestEnvironment({projectId,firestore:{rules:await readFile("firestore.rules","utf8")}});
 try{
  await environment.clearFirestore();
  const store=firestoreIntake(),input={requestId:crypto.randomUUID(),items:[{productId:"bedroom-lighting" as const,quantity:1 as const}]};
  const task=orderTask("owner","cart",input);
  const [a,b]=await Promise.all([store.prepare(task),store.prepare(task)]);assert.equal(a.id,b.id);
  assert.equal((await store.due(25)).length,1);
  await assert.rejects(store.prepare({...task,uid:"another"}),/REQUEST_CONFLICT/);
  await assert.rejects(store.prepare({...task,hash:"changed"}),/REQUEST_CONFLICT/);
  const owner=environment.authenticatedContext("owner").firestore();
  const other=environment.authenticatedContext("another").firestore();
  await assertFails(getDoc(doc(owner,"checkout_intake",task.id)));
  await assertFails(getDoc(doc(other,"checkout_intake",task.id)));
  await assertFails(setDoc(doc(owner,"checkout_intake",task.id),{state:"synced"}));
  await store.fail(task.id,"DEPENDENCY_UNAVAILABLE",false);
  assert.equal((await store.due(25)).length,0);
  await store.finish(task.id,buildCart(task.uid,input));
  await store.fail(task.id,"LATE_FAILURE",false);
  assert.equal((await store.prepare(task)).state,"synced");
 }finally{await environment.cleanup()}
});
