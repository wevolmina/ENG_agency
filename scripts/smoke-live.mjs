// Explicit live smoke test: creates two anonymous users and one mock payment.
// No card charge, user password, admin secret, or token is written to disk/output.
import assert from "node:assert/strict";
const base=process.env.LIVE_API_BASE||"https://paybridge-mock.vercel.app";
const key=process.env.LIVE_FIREBASE_API_KEY;
if(!key)throw new Error("LIVE_FIREBASE_API_KEY required");
async function guest(){const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({returnSecureToken:true}),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw new Error("GUEST_AUTH_"+(data.error?.message||r.status));return data.idToken;}
async function call(path,token,body){const r=await fetch(base+path,{method:body?"POST":"GET",headers:{Origin:"https://paybridge-mock.web.app",...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(35000)});return {status:r.status,data:await r.json(),origin:r.headers.get("access-control-allow-origin")};}
const token=await guest();
const input={productId:"starter",quantity:1,requestId:crypto.randomUUID()};
const denied=await call("/api/receipt?paymentId=pay_"+"a".repeat(40));assert.equal(denied.status,401);
const invalid=await call("/api/checkout",token,{...input,amount:1});assert.equal(invalid.status,400);
const first=await call("/api/checkout",token,input);assert.equal(first.status,200,JSON.stringify({step:"checkout",...first}));assert.equal(first.data.amount,12000);assert.equal(first.origin,"https://paybridge-mock.web.app");
const intake=await fetch(`https://firestore.googleapis.com/v1/projects/paybridge-mock/databases/(default)/documents/order_requests/${first.data.orderId}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(intake.status,200);const intakeDoc=await intake.json();assert.equal(intakeDoc.fields.requestId.stringValue,input.requestId);assert.equal(intakeDoc.fields.amount,undefined);assert.equal(intakeDoc.fields.status,undefined);
const retry=await call("/api/checkout",token,input);assert.equal(retry.status,200);assert.equal(retry.data.paymentId,first.data.paymentId);assert.equal(retry.data.createdAt,first.data.createdAt);
const conflict=await call("/api/checkout",token,{...input,quantity:2});assert.equal(conflict.status,409);
const receipt=await call("/api/receipt?paymentId="+first.data.paymentId,token);assert.equal(receipt.status,200);assert.equal(receipt.data.amount,12000);
const other=await guest();assert.equal((await call("/api/receipt?paymentId="+first.data.paymentId,other)).status,404);
assert.equal((await call("/api/payments",token)).status,403);
const preflight=await fetch(base+"/api/checkout",{method:"OPTIONS",headers:{Origin:"https://paybridge-mock.web.app","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization,content-type"}});assert.equal(preflight.status,204);
console.log(JSON.stringify({result:"PASS",checks:["anonymous_auth","unauthenticated_denied","price_tampering_denied","checkout","firestore_intake","cors","idempotent_retry","payload_conflict","receipt","other_customer_denied","merchant_claim_required","preflight"],paymentId:first.data.paymentId,amount:first.data.amount,requestId:input.requestId,note:"One mock payment retained in production; no real charge."},null,2));
