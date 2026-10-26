import test from "node:test";
import assert from "node:assert/strict";
import type {Pool} from "mysql2/promise";
import {AccessError,accessInput,accessStatus,bootstrapMaster,recentGoogle,requireMaster,setAccess,
  applyForAccess,ownApplications,pendingApplications,reviewApplication,type AccessApplication,type AccessIdentity} from "../apps/merchant/lib/staff-access";
import {createAccessHandlers} from "../apps/merchant/lib/staff-access-http";
import {createRequestHandlers} from "../apps/merchant/lib/staff-requests-http";
const now=1800000000000;
const owner:AccessIdentity={uid:"owner-fixture",email:"owner@example.invalid",emailVerified:true,claims:{
 email:"owner@example.invalid",email_verified:true,auth_time:now/1000,firebase:{sign_in_provider:"google.com"}}};
const env={MASTER_SETUP_EMAIL:owner.email!,MASTER_SETUP_MERCHANT_ID:"fixture-shop",MASTER_SETUP_PASSWORD:"fixture-password-only"};
const password=env.MASTER_SETUP_PASSWORD;
type State={tables:boolean;master:null|{user_uid:string|null;merchant_id:string|null;failed_attempts:number;locked_until_ms:number};
 members:Record<string,{merchant_id:string;active:boolean}>;audit:unknown[][];applications:AccessApplication[];reviews:unknown[][]};
function database(){
 let state:State={tables:false,master:null,members:{},audit:[],applications:[],reviews:[]};const events:string[]=[];let failAudit=false;
 async function execute(sql:string,args:unknown[]=[]):Promise<unknown>{
  events.push(sql);
  if(sql.startsWith("CREATE TABLE")){state.tables=true;return [[],[]]}
  if(sql.startsWith("SELECT id,user_uid,role,decision"))return [[],[]];
  if(sql.startsWith("INSERT INTO staff_access_request_reviews")){if(failAudit)throw Error("fixture audit failure");state.reviews.push(args);return [[],[]];}
  if(sql.startsWith("SELECT request_id,")){
   let rows=state.applications;
   if(sql.includes("WHERE BINARY user_uid"))rows=rows.filter(r=>r.user_uid===args[0]&&r.merchant_id===args[1]&&(!sql.includes("AND role=?")||r.role===args[2]));
   else if(sql.includes("WHERE request_id=?"))rows=rows.filter(r=>r.request_id===args[0]&&r.merchant_id===args[1]);
   else rows=rows.filter(r=>r.merchant_id===args[0]&&r.status==="pending");
   return [structuredClone(rows.slice(0,101)),[]];
  }
  if(sql.startsWith("INSERT INTO staff_access_requests")){
   state.applications.push({request_id:String(args[0]),email:args[1] as string|null,display_name:args[2] as string|null,user_uid:String(args[3]),merchant_id:String(args[4]),role:args[5] as any,status:"pending",reason:"",created_at:"2026-10-26 09:00:00",reviewed_at:null});return [[],[]];
  }
  if(sql.startsWith("UPDATE staff_access_requests SET request_id")){
   const r=state.applications.find(r=>r.request_id===args[3])!;Object.assign(r,{request_id:args[0],email:args[1],display_name:args[2],status:"pending",reason:"",reviewed_at:null});return [[],[]];
  }
  if(sql.startsWith("UPDATE staff_access_requests SET status")){
   const r=state.applications.find(r=>r.request_id===args[3])!;Object.assign(r,{status:args[0],reason:args[1],reviewed_at:"2026-10-26 10:00:00"});return [[],[]];
  }
  if(sql.startsWith("SELECT user_uid,merchant_id")){
   if(!state.tables)throw Object.assign(Error("fixture missing table"),{code:"ER_NO_SUCH_TABLE"});
   return [state.master?[state.master]:[],[]];
  }
  if(sql.startsWith("INSERT INTO staff_master_setup")){state.master??={user_uid:null,merchant_id:null,failed_attempts:0,locked_until_ms:0};return [[],[]]}
  if(sql.startsWith("UPDATE staff_master_setup SET failed_attempts")){
   Object.assign(state.master!,{failed_attempts:args[0],locked_until_ms:args[1]});return [[],[]];
  }
  if(sql.startsWith("UPDATE staff_master_setup SET user_uid")){
   Object.assign(state.master!,{user_uid:args[0],merchant_id:args[1],failed_attempts:0,locked_until_ms:0});return [[],[]];
  }
  if(sql.startsWith("SELECT merchant_id FROM packages"))return [args[0]==="fixture-shop"?[{merchant_id:"fixture-shop"}]:[],[]];
  if(sql.startsWith("SELECT merchant_id,active FROM staff_memberships")){
   const m=state.members[args[0]+":"+args[1]];return [m?[m]:[],[]];
  }
  if(sql.startsWith("SELECT role,active,merchant_id FROM staff_memberships"))return [Object.entries(state.members)
    .filter(([k])=>k.startsWith(args[0]+":"))
    .map(([k,m])=>({...m,role:k.slice(String(args[0]).length+1)})),[]];
  if(sql.startsWith("SELECT user_uid,role,active FROM staff_memberships"))return [Object.entries(state.members)
    .filter(([,m])=>m.merchant_id===args[0]).map(([k,m])=>({...m,user_uid:k.slice(0,k.lastIndexOf(":")),role:k.slice(k.lastIndexOf(":")+1)})),[]];
  if(sql.startsWith("SELECT id,actor_uid,target_uid"))return [[],[]];
  if(sql.startsWith("INSERT INTO staff_memberships")){
   const key=args[0]+":"+args[2];if(state.members[key])throw Error("duplicate fixture member");
   state.members[key]={merchant_id:String(args[1]),active:args.length===3?true:!!args[3]};return [[],[]];
  }
  if(sql.startsWith("UPDATE staff_memberships SET active=TRUE")){
   state.members[args[0]+":"+args[1]].active=true;return [[],[]];
  }
  if(sql.startsWith("UPDATE staff_memberships SET active=?")){
   state.members[args[1]+":"+args[2]].active=!!args[0];return [[],[]];
  }
  if(sql.startsWith("INSERT INTO staff_access_audit")){state.audit.push(args);return [[],[]]}
  throw Error("Unrecognized fixture SQL: "+sql);
 }
 const pool={execute,getConnection:async()=>{
  let snapshot:State;
  return {execute,beginTransaction:async()=>{events.push("BEGIN");snapshot=structuredClone(state)},
   commit:async()=>{events.push("COMMIT")},rollback:async()=>{events.push("ROLLBACK");state=snapshot},release:()=>events.push("RELEASE")};
 }} as unknown as Pool;
 return {pool,events,get state(){return state},set failAudit(value:boolean){failAudit=value}};
}
async function initialized(includeMerchant=false){const db=database();await bootstrapMaster(db.pool,owner,{password,includeMerchant},env,now);return db}
function hasCode(code:string){return (e:unknown)=>e instanceof AccessError&&e.code===code}
test("access input never accepts caller email, shop, master UID or extra roles",()=>{
 assert(accessInput.safeParse({action:"bootstrap",password:"fixture",includeMerchant:false}).success);
 for(const extra of [{email:owner.email},{merchantId:"other"},{uid:"root"},{role:"master"}])
  assert.equal(accessInput.safeParse({action:"bootstrap",password:"fixture",includeMerchant:false,...extra}).success,false);
 assert.equal(accessInput.safeParse({action:"set",uid:"owner fixture",role:"admin",active:true,expectedActive:null}).success,false);
 assert.equal(accessInput.safeParse({action:"set",uid:"valid",role:"master",active:true,expectedActive:null}).success,false);
});
test("initial setup status is private to the configured verified Google account",async()=>{
 const db=database();
 assert.deepEqual(await accessStatus(db.pool,owner,env,now),{isMaster:false,canSetup:true,needsRecentLogin:false});
 assert.equal((await accessStatus(db.pool,{...owner,email:"other@example.invalid"},env,now)).canSetup,false);
 assert.equal((await accessStatus(db.pool,{...owner,emailVerified:false},env,now)).canSetup,false);
 assert.equal((await accessStatus(db.pool,owner,{},now)).canSetup,false);
 assert.equal(db.state.tables,false,"GET never creates tables");
});
test("Google issuer, verified email, actual account email and recent auth are all required",async()=>{
 for(const user of [
  {...owner,emailVerified:false},{...owner,claims:{...owner.claims,email_verified:false}},
  {...owner,claims:{...owner.claims,email:"different@example.invalid"}},
  {...owner,claims:{...owner.claims,firebase:{sign_in_provider:"password"}}},
  {...owner,email:"other@example.invalid",claims:{...owner.claims,email:"other@example.invalid"}},
 ]){const db=database();await assert.rejects(bootstrapMaster(db.pool,user,{password,includeMerchant:false},env,now),hasCode("MASTER_ACCESS_REQUIRED"));assert.deepEqual(db.events,[])}
 for(const auth_time of [now/1000-301,now/1000+31,NaN]){
  const user={...owner,claims:{...owner.claims,auth_time}};assert.equal(recentGoogle(user,now),false);
  await assert.rejects(bootstrapMaster(database().pool,user,{password,includeMerchant:false},env,now),hasCode("RECENT_LOGIN_REQUIRED"));
 }
});
test("setup fails closed before writes when server configuration is absent",async()=>{
 const db=database();await assert.rejects(bootstrapMaster(db.pool,owner,{password,includeMerchant:false},{},now),hasCode("MASTER_SETUP_NOT_CONFIGURED"));assert.deepEqual(db.events,[]);
});
test("first setup binds the signed-in UID once, optionally grants seller, and audits in one transaction",async()=>{
 const db=await initialized(true);
 assert.equal(db.state.master?.user_uid,owner.uid);assert.equal(db.state.master?.merchant_id,"fixture-shop");
 assert.equal(db.state.members[owner.uid+":admin"].active,true);assert.equal(db.state.members[owner.uid+":merchant"].active,true);
 assert.equal(db.state.audit.length,2);assert(db.events.some(x=>x.includes("staff_master_setup WHERE id=1 FOR UPDATE")));
 assert.deepEqual(await accessStatus(db.pool,owner,{},now),{isMaster:true,canSetup:false,needsRecentLogin:false},"password can be removed after setup");
 await assert.rejects(bootstrapMaster(db.pool,owner,{password,includeMerchant:true},env,now),hasCode("MASTER_SETUP_CLOSED"));
 assert.equal(db.state.audit.length,2);
});
test("seller access is opt-in during master setup",async()=>{
 const db=await initialized();assert.equal(db.state.members[owner.uid+":merchant"],undefined);assert.equal(db.state.audit.length,1);
});
test("five wrong passwords commit a shared 15 minute lock and do not grant any roles",async()=>{
 const db=database();
 for(let n=1;n<=5;n++)await assert.rejects(bootstrapMaster(db.pool,owner,{password:"wrong-fixture",includeMerchant:true},env,now),hasCode(n===5?"SETUP_TRY_LATER":"SETUP_PASSWORD_INVALID"));
 assert.equal(db.state.master?.failed_attempts,5);assert.equal(db.state.master?.locked_until_ms,now+15*60*1000);
 await assert.rejects(bootstrapMaster(db.pool,owner,{password,includeMerchant:true},env,now+1000),hasCode("SETUP_TRY_LATER"));
 assert.deepEqual(db.state.members,{});assert.deepEqual(db.state.audit,[]);
 const later=now+15*60*1000+1,fresh={...owner,claims:{...owner.claims,auth_time:Math.floor(later/1000)}};
 await bootstrapMaster(db.pool,fresh,{password,includeMerchant:false},env,later);
 assert.equal(db.state.members[owner.uid+":admin"].active,true);
 assert(db.events.every(sql=>!sql.includes(password)&&!sql.includes("wrong-fixture")));
});
test("a conflicting old shop or unknown shop rolls back all setup role and audit writes",async()=>{
 for(const mismatch of [true,false]){
  const db=database();if(mismatch)db.state.members[owner.uid+":merchant"]={merchant_id:"another-shop",active:true};
  await assert.rejects(bootstrapMaster(db.pool,owner,{password,includeMerchant:true},mismatch?env:{...env,MASTER_SETUP_MERCHANT_ID:"missing-shop"},now),hasCode(mismatch?"ACCOUNT_OTHER_STORE":"MASTER_STORE_NOT_FOUND"));
  assert.equal(db.state.members[owner.uid+":admin"],undefined);assert.deepEqual(db.state.audit,[]);assert.equal(db.state.master,null);
 }
});
test("an ordinary admin or another UID with matching email is not the master",async()=>{
 const db=await initialized();db.state.members["other:admin"]={merchant_id:"fixture-shop",active:true};
 await assert.rejects(requireMaster(db.pool,{...owner,uid:"other"}),hasCode("MASTER_ACCESS_REQUIRED"));
 db.state.members[owner.uid+":admin"].active=false;
 await assert.rejects(requireMaster(db.pool,owner),hasCode("MASTER_ACCESS_REQUIRED"));
});
test("master approves and revokes scoped roles with optimistic conflict checks and audit",async()=>{
 const db=await initialized();
 await setAccess(db.pool,owner,{uid:"seller",role:"merchant",active:true,expectedActive:null},now);
 assert.equal(db.state.members["seller:merchant"].active,true);
 assert.equal(db.state.members["seller:admin"],undefined);
 await assert.rejects(setAccess(db.pool,owner,{uid:"seller",role:"merchant",active:false,expectedActive:null},now),hasCode("ACCESS_VERSION_CONFLICT"));
 await setAccess(db.pool,owner,{uid:"seller",role:"merchant",active:false,expectedActive:true},now);
 assert.equal(db.state.members["seller:merchant"].active,false);assert.equal(db.state.audit.length,3);
 assert.deepEqual(db.state.audit[2].slice(0,4),[owner.uid,"seller","fixture-shop","merchant"]);
});
test("master admin role and other shop bindings cannot be removed or moved",async()=>{
 const db=await initialized();
 await assert.rejects(setAccess(db.pool,owner,{uid:owner.uid,role:"admin",active:false,expectedActive:true},now),hasCode("MASTER_ADMIN_PROTECTED"));
 db.state.members["other:merchant"]={merchant_id:"another-shop",active:false};
 await assert.rejects(setAccess(db.pool,owner,{uid:"other",role:"merchant",active:true,expectedActive:false},now),hasCode("ACCOUNT_OTHER_STORE"));
 assert.equal(db.state.members[owner.uid+":admin"].active,true);assert.equal(db.state.members["other:merchant"].active,false);
});
test("stale login cannot change membership even when UID is the master",async()=>{
 const db=await initialized();await assert.rejects(setAccess(db.pool,{...owner,claims:{...owner.claims,auth_time:now/1000-301}},
  {uid:"seller",role:"merchant",active:true,expectedActive:null},now),hasCode("RECENT_LOGIN_REQUIRED"));
 assert.equal(db.state.members["seller:merchant"],undefined);
});
const adminOrigin="https://admin.example.invalid";
function apiRequest(body:unknown,origin:string|null=adminOrigin,token=true){return new Request("https://api.example.invalid/api/admin/access",{
 method:"POST",headers:{...(origin?{origin}:{}),...(token?{authorization:"Bearer fixture-token"}:{}),"content-type":"application/json"},body:JSON.stringify(body)});}
function http(db:ReturnType<typeof database>,user:AccessIdentity=owner,account?:(uid:string)=>Promise<any>,accounts?:(uids:string[])=>Promise<{users:{uid:string;email?:string}[]}>){
 let authCalls=0,accountCalls=0;
 const h=createAccessHandlers({env:{...env,ADMIN_SITE_ORIGIN:adminOrigin},pool:()=>db.pool,now:()=>now,
  identity:async request=>{authCalls++;return request.headers.get("authorization")==="Bearer fixture-token"?user:null},
  account:async id=>{accountCalls++;return account?account(id):{uid:id,disabled:false,providerData:[{providerId:"google.com"}],email:"target@example.invalid"}},
  accounts:accounts|| (async ids=>({users:ids.map(uid=>({uid,email:"registered@example.invalid"}))}))});
 return {...h,get authCalls(){return authCalls},get accountCalls(){return accountCalls}};
}
test("HTTP blocks missing/external origin and unauthenticated callers before any database access",async()=>{
 const db=database(),h=http(db);
 for(const origin of [null,"https://evil.example"]){assert.equal((await h.POST(apiRequest({action:"bootstrap",password,includeMerchant:true},origin))).status,403)}
 assert.equal(h.authCalls,0);assert.deepEqual(db.events,[]);
 assert.equal((await h.POST(apiRequest({action:"bootstrap",password,includeMerchant:true},adminOrigin,false))).status,401);
 assert.deepEqual(db.events,[]);
});
test("HTTP accepts only bounded strict JSON and never exposes passwords in errors",async()=>{
 const db=database(),h=http(db);
 for(const body of [{action:"bootstrap",password,includeMerchant:true,email:owner.email},{action:"bootstrap",password:"x".repeat(3000),includeMerchant:true}]){
  const response=await h.POST(apiRequest(body));assert.equal(response.status,400);assert(!(await response.text()).includes(password));
 }
 assert.deepEqual(db.events,[]);
 const r=await h.POST(apiRequest({action:"bootstrap",password:"incorrect-fixture",includeMerchant:false}));
 assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:"SETUP_PASSWORD_INVALID"});assert.equal(r.headers.get("access-control-allow-origin"),adminOrigin);assert.match(r.headers.get("cache-control")!,/no-store/);
});
test("HTTP bootstrap completes one-time setup; subsequent requests cannot reuse the password",async()=>{
 const db=database(),h=http(db);
 const r=await h.POST(apiRequest({action:"bootstrap",password,includeMerchant:true}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
 assert.equal((await h.POST(apiRequest({action:"bootstrap",password,includeMerchant:true}))).status,409);
 const status=await h.GET(new Request("https://api.example.invalid/api/admin/access",{headers:{origin:adminOrigin,authorization:"Bearer fixture-token"}}));
 const data=await status.json();assert.equal(data.isMaster,true);assert.equal(data.canSetup,false);assert.equal(data.members.length,2);
 assert(!JSON.stringify(data).includes(password));
});
test("HTTP cannot enumerate accounts or grant roles when a regular admin calls it",async()=>{
 const db=await initialized(),h=http(db,{...owner,uid:"regular-admin"});
 db.state.members["regular-admin:admin"]={merchant_id:"fixture-shop",active:true};
 assert.equal((await h.POST(apiRequest({action:"lookup",uid:"target"}))).status,403);
 assert.equal((await h.POST(apiRequest({action:"set",uid:"target",role:"admin",active:true,expectedActive:null}))).status,403);
 assert.equal(h.accountCalls,0);assert.equal(db.state.members["target:admin"],undefined);
});
test("HTTP approval verifies target existence, disabled state, and non-anonymous sign-in",async()=>{
 for(const [target,code] of [[null,"ACCOUNT_NOT_FOUND"],[{uid:"target",disabled:true,providerData:[]},"ACCOUNT_DISABLED"],[{uid:"target",disabled:false,providerData:[]},"ACCOUNT_LOGIN_REQUIRED"]] as const){
  const db=await initialized(),h=http(db,owner,async()=>{if(!target)throw Object.assign(Error("fixture not found"),{code:"auth/user-not-found"});return target});
  const r=await h.POST(apiRequest({action:"set",uid:"target",role:"merchant",active:true,expectedActive:null}));assert.equal((await r.json()).error,code);
  assert.equal(db.state.members["target:merchant"],undefined);
 }
});
test("HTTP permits custom-provider targets and can revoke an account that Firebase no longer has",async()=>{
 const db=await initialized(),id="social:kakao:"+"a".repeat(64),h=http(db,owner,async()=>({uid:id,disabled:false,providerData:[]}));
 assert.equal((await h.POST(apiRequest({action:"lookup",uid:id}))).status,200);
 assert.equal((await h.POST(apiRequest({action:"set",uid:id,role:"merchant",active:true,expectedActive:null}))).status,200);
 const unavailable=http(db,owner,async()=>{throw Error("Firebase fixture unavailable")});
 assert.equal((await unavailable.POST(apiRequest({action:"set",uid:id,role:"merchant",active:false,expectedActive:true}))).status,200);
 assert.equal(unavailable.accountCalls,0);assert.equal(db.state.members[id+":merchant"].active,false);
});
test("HTTP preflight permits only the configured admin origin and supported methods and headers",()=>{
 const h=http(database());
 for(const method of ["GET","POST"]){const r=h.OPTIONS(new Request("https://api.example.invalid/api/admin/access",{method:"OPTIONS",headers:{origin:adminOrigin,"access-control-request-method":method,"access-control-request-headers":"authorization,content-type"}}));assert.equal(r.status,204)}
 assert.equal(h.OPTIONS(new Request("https://api.example.invalid/api/admin/access",{method:"OPTIONS",headers:{origin:adminOrigin,"access-control-request-method":"DELETE"}})).status,403);
});
test("registered emails are batch-scoped to distinct current-shop UIDs and full Firebase records never escape",async()=>{
 const db=await initialized(true);db.state.members["outsider:merchant"]={merchant_id:"other-shop",active:true};
 let ids:string[]=[];
 const h=http(db,owner,undefined,async input=>{ids=input;return {users:[{uid:owner.uid,email:"registered@example.invalid",passwordHash:"never-return",customClaims:{admin:true}} as any,{uid:"outsider",email:"outside@example.invalid"}]}});
 const r=await h.GET(new Request("https://api.example.invalid/api/admin/access",{headers:{origin:adminOrigin,authorization:"Bearer fixture-token"}}));
 const d=await r.json();assert.deepEqual(ids,[owner.uid]);assert.equal(d.members.length,2);
 assert(d.members.every((m:any)=>m.email==="registered@example.invalid"&&m.emailStatus==="available"));
 const body=JSON.stringify(d);for(const hidden of ["never-return","passwordHash","customClaims","outside@example.invalid"])assert(!body.includes(hidden));
});
test("Firebase email lookup failure keeps scoped roles available with an explicit unavailable status",async()=>{
 const db=await initialized();
 const h=http(db,owner,undefined,async()=>{throw Error("private-firebase-credential-detail")});
 const r=await h.GET(new Request("https://api.example.invalid/api/admin/access",{headers:{origin:adminOrigin,authorization:"Bearer fixture-token"}}));
 const d=await r.json();assert.equal(r.status,200);assert.equal(d.members[0].email,null);assert.equal(d.members[0].emailStatus,"unavailable");
 assert(!JSON.stringify(d).includes("private-firebase-credential-detail"));
});
test("non-master account status never queries or exposes registered user emails",async()=>{
 let calls=0;const h=http(database(),{...owner,uid:"ordinary-user"},undefined,async()=>{calls++;return {users:[]}});
 const r=await h.GET(new Request("https://api.example.invalid/api/admin/access",{headers:{origin:adminOrigin,authorization:"Bearer fixture-token"}}));
 const d=await r.json();assert.equal(calls,0);assert.equal(d.members,undefined);
});
test("slow Firebase email lookup times out without blocking the authorized role list",{timeout:10000},async()=>{
 const db=await initialized(),h=http(db,owner,undefined,()=>new Promise(()=>{}));
 const r=await h.GET(new Request("https://api.example.invalid/api/admin/access",{headers:{origin:adminOrigin,authorization:"Bearer fixture-token"}}));
 const d=await r.json();assert.equal(r.status,200);assert.equal(d.members[0].emailStatus,"unavailable");
});

const applicant:AccessIdentity={...owner,uid:"new-person",email:"new@example.invalid",claims:{...owner.claims,email:"new@example.invalid"}};
const profile={email:"new@example.invalid",displayName:"새 신청자"};
test("application is bound to authenticated account and shop; duplicate submission stays pending without granting a role",async()=>{
 const db=await initialized(),first=await applyForAccess(db.pool,applicant,"merchant",profile),second=await applyForAccess(db.pool,applicant,"merchant",profile);
 assert.equal(first.requestId,second.requestId);assert.equal(db.state.applications.length,1);assert.equal(db.state.applications[0].user_uid,applicant.uid);
 assert.equal(db.state.members[applicant.uid+":merchant"],undefined);
 assert.equal((await ownApplications(db.pool,{...applicant,uid:"stranger"})).requests.length,0);
 assert.equal((await ownApplications(db.pool,applicant)).requests.length,1);
});
test("master accepts requested seller or admin role atomically with role audit and application result",async()=>{
 for(const role of ["merchant","admin"] as const){const db=await initialized(),r=await applyForAccess(db.pool,applicant,role,profile);
  await reviewApplication(db.pool,owner,{requestId:r.requestId,decision:"approved",reason:""},now);
  assert.equal(db.state.members[applicant.uid+":"+role].active,true);assert.equal(db.state.members[applicant.uid+":"+(role==="admin"?"merchant":"admin")],undefined);
  assert.equal(db.state.applications[0].status,"approved");assert.equal(db.state.audit.length,2);
  await assert.rejects(reviewApplication(db.pool,owner,{requestId:r.requestId,decision:"rejected",reason:"late"},now),hasCode("APPLICATION_ALREADY_REVIEWED"));
  assert.equal(db.state.applications[0].status,"approved");
 }
});
test("rejection grants no role, returns reason to owner, and reapplication replaces its ID so stale review cannot act",async()=>{
 const db=await initialized(),r=await applyForAccess(db.pool,applicant,"admin",profile);
 await reviewApplication(db.pool,owner,{requestId:r.requestId,decision:"rejected",reason:"신청 정보 확인 필요"},now);
 assert.equal(db.state.members[applicant.uid+":admin"],undefined);assert.equal((await ownApplications(db.pool,applicant)).requests[0].reason,"신청 정보 확인 필요");
 const next=await applyForAccess(db.pool,applicant,"admin",profile);assert.notEqual(next.requestId,r.requestId);assert.equal(db.state.applications.length,1);
 await assert.rejects(reviewApplication(db.pool,owner,{requestId:r.requestId,decision:"approved",reason:""},now),hasCode("APPLICATION_NOT_FOUND"));
 assert.equal(db.state.applications[0].status,"pending");assert.equal(db.state.reviews.length,1,"reapplication preserves rejection history");
});
test("ordinary admins cannot list or review requests; stale master login cannot review",async()=>{
 const db=await initialized(),r=await applyForAccess(db.pool,applicant,"admin",profile);db.state.members[applicant.uid+":admin"]={merchant_id:"fixture-shop",active:true};
 await assert.rejects(pendingApplications(db.pool,applicant),hasCode("MASTER_ACCESS_REQUIRED"));
 await assert.rejects(reviewApplication(db.pool,applicant,{requestId:r.requestId,decision:"approved",reason:""},now),hasCode("MASTER_ACCESS_REQUIRED"));
 await assert.rejects(reviewApplication(db.pool,{...owner,claims:{...owner.claims,auth_time:now/1000-301}},{requestId:r.requestId,decision:"approved",reason:""},now),hasCode("RECENT_LOGIN_REQUIRED"));
 assert.equal(db.state.applications[0].status,"pending");
});
test("active role and other-store role cannot apply; approval conflict rolls back the pending application",async()=>{
 const db=await initialized();db.state.members[applicant.uid+":merchant"]={merchant_id:"fixture-shop",active:true};
 await assert.rejects(applyForAccess(db.pool,applicant,"merchant",profile),hasCode("ROLE_ALREADY_ACTIVE"));
 const r=await applyForAccess(db.pool,applicant,"admin",profile);db.state.members[applicant.uid+":admin"]={merchant_id:"different-shop",active:false};
 await assert.rejects(reviewApplication(db.pool,owner,{requestId:r.requestId,decision:"approved",reason:""},now),hasCode("ACCOUNT_OTHER_STORE"));
 assert.equal(db.state.applications[0].status,"pending");assert.equal(db.state.members[applicant.uid+":admin"].active,false);
 await assert.rejects(applyForAccess(db.pool,applicant,"admin",profile),hasCode("ACCOUNT_OTHER_STORE"));
});
function requestHttp(db:ReturnType<typeof database>,user:AccessIdentity|null=applicant,disabled=false,anonymous=false){return createRequestHandlers({env:{ADMIN_SITE_ORIGIN:adminOrigin},pool:()=>db.pool,identity:async()=>user,account:async uid=>({uid,...profile,disabled,providerData:anonymous?[]:[{providerId:"google.com"}]})})}
function applicationRequest(body:unknown,origin:string|null="https://api.example.invalid"){return new Request("https://api.example.invalid/api/staff/requests",{method:"POST",headers:{...(origin?{origin}:{}),"content-type":"application/json"},body:JSON.stringify(body)})}
test("request API accepts seller same-origin or admin origin and ignores no caller-controlled identity, email or shop",async()=>{
 const db=await initialized(),h=requestHttp(db);
 for(const extra of [{uid:"victim"},{email:"spoof@example.invalid"},{merchantId:"other"},{role:"master"}])assert.equal((await h.POST(applicationRequest({role:"merchant",...extra}))).status,400);
 assert.equal(db.state.applications.length,0);
 assert.equal((await h.POST(applicationRequest({role:"merchant"}))).status,200);
 assert.equal((await h.POST(applicationRequest({role:"admin"},adminOrigin))).status,200);
 assert(db.state.applications.every(r=>r.user_uid===applicant.uid&&r.merchant_id==="fixture-shop"&&r.email===profile.email));
 const r=await h.GET(new Request("https://api.example.invalid/api/staff/requests"));assert.match(r.headers.get("cache-control")!,/no-store/);assert.equal((await r.json()).requests.length,2);
});
test("request API blocks external or absent POST origin, signed-out, disabled and anonymous accounts and oversized JSON",async()=>{
 const db=await initialized();
 for(const origin of [null,"https://evil.example.invalid"])assert.equal((await requestHttp(db).POST(applicationRequest({role:"merchant"},origin))).status,403);
 for(const [h,status] of [[requestHttp(db,null),401],[requestHttp(db,applicant,true),409],[requestHttp(db,applicant,false,true),409]] as const)assert.equal((await h.POST(applicationRequest({role:"admin"}))).status,status);
 assert.equal((await requestHttp(db).POST(applicationRequest({role:"merchant",padding:"a".repeat(2000)}))).status,400);assert.equal(db.state.applications.length,0);
});
test("request preflight permits only explicit origins, GET/POST, and bearer/JSON headers",()=>{
 const h=requestHttp(database());
 for(const origin of [adminOrigin,"https://api.example.invalid"]){const r=h.OPTIONS(new Request("https://api.example.invalid/api/staff/requests",{method:"OPTIONS",headers:{origin,"access-control-request-method":"POST","access-control-request-headers":"authorization,content-type"}}));assert.equal(r.status,204);assert.equal(r.headers.get("access-control-allow-origin"),origin)}
 for(const method of ["DELETE","PUT"])assert.equal(h.OPTIONS(new Request("https://api.example.invalid/api/staff/requests",{method:"OPTIONS",headers:{origin:adminOrigin,"access-control-request-method":method}})).status,403);
});
test("review HTTP validates master and current target account before granting pending role",async()=>{
 const db=await initialized(),r=await applyForAccess(db.pool,applicant,"merchant",profile);
 assert.equal((await http(db,applicant).POST(apiRequest({action:"review",requestId:r.requestId,decision:"approved"}))).status,403);
 assert.equal((await http(db,owner,async uid=>({uid,disabled:true,providerData:[{providerId:"google.com"}]})).POST(apiRequest({action:"review",requestId:r.requestId,decision:"approved"}))).status,409);
 assert.equal((await http(db).POST(apiRequest({action:"review",requestId:r.requestId,decision:"approved",uid:"victim"}))).status,400);
 assert.equal((await http(db).POST(apiRequest({action:"review",requestId:r.requestId,decision:"approved"}))).status,200);
 assert.equal(db.state.members[applicant.uid+":merchant"].active,true);
});

test("review audit failure rolls back role and application changes together",async()=>{
 const db=await initialized(),r=await applyForAccess(db.pool,applicant,"merchant",profile);db.failAudit=true;
 await assert.rejects(reviewApplication(db.pool,owner,{requestId:r.requestId,decision:"approved",reason:""},now),/fixture audit failure/);
 assert.equal(db.state.applications[0].status,"pending");assert.equal(db.state.members[applicant.uid+":merchant"],undefined);assert.equal(db.state.audit.length,1);assert.equal(db.state.reviews.length,0);
});
