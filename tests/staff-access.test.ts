import test from "node:test";
import assert from "node:assert/strict";
import type {Pool} from "mysql2/promise";
import {AccessError,accessInput,accessStatus,bootstrapMaster,recentGoogle,requireMaster,setAccess,
  type AccessIdentity} from "../apps/merchant/lib/staff-access";
import {createAccessHandlers} from "../apps/merchant/lib/staff-access-http";
const now=1800000000000;
const owner:AccessIdentity={uid:"owner-fixture",email:"owner@example.invalid",emailVerified:true,claims:{
 email:"owner@example.invalid",email_verified:true,auth_time:now/1000,firebase:{sign_in_provider:"google.com"}}};
const env={MASTER_SETUP_EMAIL:owner.email!,MASTER_SETUP_MERCHANT_ID:"fixture-shop",MASTER_SETUP_PASSWORD:"fixture-password-only"};
const password=env.MASTER_SETUP_PASSWORD;
type State={tables:boolean;master:null|{user_uid:string|null;merchant_id:string|null;failed_attempts:number;locked_until_ms:number};
 members:Record<string,{merchant_id:string;active:boolean}>;audit:unknown[][]};
function database(){
 let state:State={tables:false,master:null,members:{},audit:[]};const events:string[]=[];
 async function execute(sql:string,args:unknown[]=[]):Promise<unknown>{
  events.push(sql);
  if(sql.startsWith("CREATE TABLE")){state.tables=true;return [[],[]]}
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
 return {pool,events,get state(){return state}};
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
