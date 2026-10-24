import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {doc,setDoc,getDoc,updateDoc,deleteDoc,getDocs,collection} from "firebase/firestore";
test("cart owner, unique lines, exact fields and immutable intake",{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-cart-rules',firestore:{rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
 try{const owner=env.authenticatedContext('owner').firestore(),other=env.authenticatedContext('other').firestore(),anon=env.unauthenticatedContext().firestore(),col='smartspace_cart_requests',id='ord_'+'a'.repeat(40),data={customerId:'owner',requestId:crypto.randomUUID(),items:[{productId:'bedroom-lighting',quantity:1},{productId:'desk-focus',quantity:1},{productId:'kitchen-sensing',quantity:1}]};
  await assertSucceeds(setDoc(doc(owner,col,id),data));await assertSucceeds(getDoc(doc(owner,col,id)));await assertFails(getDoc(doc(other,col,id)));await assertFails(getDocs(collection(owner,col)));await assertFails(updateDoc(doc(owner,col,id),{items:[data.items[0]]}));await assertFails(deleteDoc(doc(owner,col,id)));
  await assertSucceeds(setDoc(doc(owner,col,'ord_'+'b'.repeat(40)),{...data,items:[data.items[1]]}));await assertSucceeds(setDoc(doc(owner,col,'ord_'+'c'.repeat(40)),{...data,items:data.items.slice(0,2)}));
  for(const invalid of [{...data,customerId:'other'},{...data,amount:1},{...data,items:[]},{...data,items:[data.items[0],data.items[0]]},{...data,items:[...data.items,data.items[0]]},{...data,items:[{productId:'desk-focus',quantity:2}]},{...data,items:[{productId:'desk-focus',quantity:1,unitPrice:1}]},{...data,items:[{productId:'desk-focus',quantity:1,focus:true}]},{...data,items:[{productId:'unknown',quantity:1}]},{...data,requestId:'invalid'}])await assertFails(setDoc(doc(owner,col,'ord_'+'d'.repeat(40)),invalid));
  await assertFails(setDoc(doc(anon,col,'ord_'+'e'.repeat(40)),data));await assertFails(setDoc(doc(owner,col,'bad-id'),data));
 }finally{await env.cleanup()}
});
