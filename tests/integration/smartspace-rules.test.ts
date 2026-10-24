import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {doc,getDoc,setDoc,updateDoc,deleteDoc,collection,getDocs} from "firebase/firestore";
test("smartspace intake denies spoofing, field injection, mutation and broad reads",{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 const env=await initializeTestEnvironment({projectId:"demo-smartspace-rules",firestore:{rules:await readFile(new URL("../../firestore.rules",import.meta.url),"utf8")}});
 try{
  const owner=env.authenticatedContext("owner").firestore(),other=env.authenticatedContext("other").firestore(),anon=env.unauthenticatedContext().firestore();
  const collectionName="smartspace_order_requests",id="ord_"+"a".repeat(40),data={customerId:"owner",requestId:crypto.randomUUID(),productId:"bedroom-lighting",quantity:1};
  await assertSucceeds(setDoc(doc(owner,collectionName,id),data));
  const kitchenId="ord_"+"d".repeat(40),kitchen={...data,productId:"kitchen-sensing"};
  await assertSucceeds(setDoc(doc(owner,collectionName,kitchenId),kitchen));
  await assertSucceeds(getDoc(doc(owner,collectionName,kitchenId)));
  await assertFails(getDoc(doc(other,collectionName,kitchenId)));
  await assertFails(updateDoc(doc(owner,collectionName,kitchenId),{productId:"bedroom-lighting"}));
  await assertFails(setDoc(doc(owner,collectionName,"ord_"+"e".repeat(40)),{...kitchen,presence:true}));
  await assertFails(setDoc(doc(owner,collectionName,"ord_"+"f".repeat(40)),{...kitchen,door:true}));
  await assertSucceeds(getDoc(doc(owner,collectionName,id)));
  await assertFails(getDoc(doc(other,collectionName,id)));await assertFails(getDoc(doc(anon,collectionName,id)));
  await assertFails(getDocs(collection(owner,collectionName)));await assertFails(deleteDoc(doc(owner,collectionName,id)));
  await assertFails(updateDoc(doc(owner,collectionName,id),{quantity:2}));await assertFails(updateDoc(doc(owner,collectionName,id),{customerId:"other"}));
  for(const invalid of [{...data,customerId:"other"},{...data,quantity:11},{...data,quantity:0},{...data,quantity:1.1},{...data,amount:1},{...data,role:"admin"},{...data,status:"APPROVED"},{...data,productId:"starter"},{...data,requestId:"x".repeat(5000)},{customerId:"owner",productId:"bedroom-lighting",quantity:1}])await assertFails(setDoc(doc(owner,collectionName,"ord_"+"b".repeat(40)),invalid));
  await assertFails(setDoc(doc(owner,collectionName,"bad-id"),data));await assertFails(setDoc(doc(anon,collectionName,"ord_"+"c".repeat(40)),data));
  await assertFails(setDoc(doc(owner,"staff_memberships","owner"),{role:"admin"}));
 }finally{await env.cleanup()}
});
