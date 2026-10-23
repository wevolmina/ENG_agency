import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {doc,getDoc,setDoc,collection,getDocs} from "firebase/firestore";
test("Firestore: 본인 영수증만 읽고 브라우저 직접 쓰기·목록 읽기는 거부",{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const env=await initializeTestEnvironment({projectId:"demo-payment-bridge",firestore:{rules:await readFile(new URL("../../firestore.rules",import.meta.url),"utf8")}});
  try{await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),"payments","test-receipt"),{customerId:"owner",amount:12000});});
    const owner=env.authenticatedContext("owner").firestore(),other=env.authenticatedContext("other").firestore();
    await assertSucceeds(getDoc(doc(owner,"payments","test-receipt")));
    await assertFails(getDoc(doc(other,"payments","test-receipt")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),"payments","test-receipt")));
    await assertFails(setDoc(doc(owner,"payments","new"),{customerId:"owner",amount:1}));
    await assertFails(getDocs(collection(owner,"payments")));
  }finally{await env.cleanup();}
});
