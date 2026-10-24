import {test} from "node:test";
import assert from "node:assert/strict";
import {buildPayment,createInput,paymentSchema} from "../functions/src/domain";
test("bedroom mock checkout uses server price and stable IDs",()=>{
 const input={productId:"bedroom-lighting" as const,quantity:1,requestId:crypto.randomUUID()};
 const a=buildPayment("buyer-a",input),b=buildPayment("buyer-a",input);
 assert.equal(a.amount,99000);assert.equal(a.status,"MOCK_APPROVED");assert.equal(a.productName,"편안한 밤 조명 패키지");
 assert.equal(a.paymentId,b.paymentId);assert.notEqual(a.paymentId,buildPayment("buyer-b",input).paymentId);
 assert.equal(createInput.safeParse({...input,amount:1}).success,false);
 assert.equal(paymentSchema.safeParse({...a,status:"APPROVED"}).success,false);
 assert.equal(buildPayment("buyer-a",{...input,quantity:10}).amount,990000);
});
