import {buildPayment,createInput} from "../../../functions/src/domain";
import {buildCart,cartHash,cartInput,type CartInput} from "./cart";
import {requestHash,type OrderInput,type StoredReceipt} from "./checkout";
export type OrderTask={
 id:string;uid:string;kind:"single"|"cart";input:OrderInput|CartInput;hash:string;
 state:"pending"|"synced"|"blocked";createdAt:number;nextAttemptAt:number;
 attempts:number;receipt?:StoredReceipt;lastError?:string;
};
export interface IntakeStore {
 prepare(task:OrderTask):Promise<OrderTask>;
 finish(id:string,receipt:StoredReceipt):Promise<void>;
 fail(id:string,code:string,blocked:boolean):Promise<void>;
 due(limit:number):Promise<OrderTask[]>;
}
export function orderTask(uid:string,kind:"single"|"cart",value:unknown):OrderTask {
 const now=Date.now();
 if(kind==="single"){
  const input=createInput.parse(value);
  return {id:buildPayment(uid,input).orderId,uid,kind,input,hash:requestHash(input),state:"pending",createdAt:now,nextAttemptAt:now,attempts:0};
 }
 const input=cartInput.parse(value);
 return {id:buildCart(uid,input).orderId,uid,kind,input,hash:cartHash(input),state:"pending",createdAt:now,nextAttemptAt:now,attempts:0};
}
export function orderService(store:IntakeStore,confirm:(task:OrderTask)=>Promise<StoredReceipt>){
 async function process(task:OrderTask){
  if(task.state==="synced"&&task.receipt)return {status:200,body:task.receipt};
  if(task.state==="blocked")return {status:409,body:{error:task.lastError||"ORDER_BLOCKED"}};
  try{
   const receipt=await confirm(task);
   // An acknowledgement failure leaves the durable intake pending. SQL's unique
   // customer/request constraint makes the next attempt return the same receipt.
   await store.finish(task.id,receipt);
   return {status:200,body:receipt};
  }catch(error){
   const code=error instanceof Error?error.message:"DEPENDENCY_UNAVAILABLE";
   const blocked=["REQUEST_CONFLICT","PACKAGE_UNAVAILABLE","PACKAGE_CHANGED"].includes(code);
   try{await store.fail(task.id,blocked?code:"DEPENDENCY_UNAVAILABLE",blocked)}catch{/* Intake already exists; daily retry can still recover it. */}
   return blocked?{status:409,body:{error:code}}:{status:202,body:{status:"PROCESSING",orderId:task.id}};
  }
 }
 return {
  submit:async(task:OrderTask)=>process(await store.prepare(task)),
  reconcile:async(limit=25)=>{
   const tasks=await store.due(Math.min(25,Math.max(1,limit)));
   let completed=0,pending=0,blocked=0;
   for(const task of tasks){const result=await process(task);if(result.status===200)completed++;else if(result.status===409)blocked++;else pending++;}
   return {checked:tasks.length,completed,pending,blocked};
  }
 };
}
