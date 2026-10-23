import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {doc,getDoc,setDoc,updateDoc,deleteDoc,collection,getDocs} from "firebase/firestore";
test("Firestore order intake ownership, schema, immutability and payment denial",{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 const env=await initializeTestEnvironment({projectId:"demo-payment-bridge",firestore:{rules:await readFile(new URL("../../firestore.rules",import.meta.url),"utf8")}});
 try{
  const owner=env.authenticatedContext("owner").firestore(),other=env.authenticatedContext("other").firestore();
  const id="ord_"+"a".repeat(40),data={customerId:"owner",requestId:crypto.randomUUID(),productId:"starter",quantity:1};
  await assertSucceeds(setDoc(doc(owner,"order_requests",id),data));
  await assertSucceeds(getDoc(doc(owner,"order_requests",id)));
  await assertFails(getDoc(doc(other,"order_requests",id)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),"order_requests",id)));
  await assertFails(getDocs(collection(owner,"order_requests")));
  await assertFails(updateDoc(doc(owner,"order_requests",id),{quantity:2}));
  await assertFails(deleteDoc(doc(owner,"order_requests",id)));
  const next="ord_"+"b".repeat(40);
  for(const invalid of [{...data,customerId:"other"},{...data,quantity:11},{...data,quantity:1.5},{...data,amount:1},{...data,status:"APPROVED"},{...data,productId:"unknown"},{...data,requestId:"x".repeat(5000)}])await assertFails(setDoc(doc(owner,"order_requests",next),invalid));
  await assertFails(setDoc(doc(other,"order_requests",next),data));
  await assertFails(setDoc(doc(owner,"payments",id),data));
 }finally{await env.cleanup();}
});
