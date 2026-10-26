import {getFirestore} from "firebase-admin/firestore";
import {adminAuth} from "./admin";
import {getPool} from "./db";
import {confirmOrder,type OrderInput} from "./checkout";
import {confirmCart,type CartInput} from "./cart";
import {orderService,type IntakeStore,type OrderTask} from "./order-service";
export function firestoreIntake():IntakeStore {
 // Same Standard Firestore document API as the existing order requests.
 // This server-only collection is denied to all browser clients by default rules.
 const db=getFirestore(adminAuth().app),collection=db.collection("checkout_intake");
 return {
  prepare:async task=>db.runTransaction(async tx=>{
   const ref=collection.doc(task.id),snap=await tx.get(ref);
   if(snap.exists){
    const prior=snap.data() as OrderTask;
    if(prior.uid!==task.uid||prior.kind!==task.kind||prior.hash!==task.hash)throw Error("REQUEST_CONFLICT");
    return prior;
   }
   tx.create(ref,task);return task;
  }),
  finish:async(id,receipt)=>db.runTransaction(async tx=>{
   const ref=collection.doc(id),snap=await tx.get(ref);
   if(!snap.exists)throw Error("INTAKE_MISSING");
   tx.update(ref,{state:"synced",receipt,completedAt:Date.now(),lastError:null});
  }),
  fail:async(id,code,blocked)=>db.runTransaction(async tx=>{
   const ref=collection.doc(id),snap=await tx.get(ref);
   if(!snap.exists||snap.get("state")==="synced")return;
   tx.update(ref,{state:blocked?"blocked":"pending",lastError:code,
    attempts:Number(snap.get("attempts")||0)+1,nextAttemptAt:Date.now()+24*60*60*1000});
  }),
  due:async limit=>{
   const snapshots=await collection.where("state","==","pending").where("nextAttemptAt","<=",Date.now())
    .orderBy("nextAttemptAt").limit(limit).get();
   return snapshots.docs.map(doc=>doc.data() as OrderTask);
  }
 };
}
export function checkoutService(){
 return orderService(firestoreIntake(),task=>task.kind==="cart"
  ?confirmCart(getPool(),task.uid,task.input as CartInput)
  :confirmOrder(getPool(),task.uid,task.input as OrderInput));
}
