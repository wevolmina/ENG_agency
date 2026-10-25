import type {Pool} from "mysql2/promise";
import {adminCors,adminOptions,configuredAdminOrigin} from "./admin-http";
import {AccessError,accessInput,accessMembers,accessStatus,bootstrapMaster,recentGoogle,requireMaster,setAccess,targetMemberships,type AccessIdentity} from "./staff-access";
type Account={uid:string;email?:string;displayName?:string;disabled:boolean;providerData:{providerId:string}[]};
type Dependencies={env:Record<string,string|undefined>;identity:(request:Request)=>Promise<AccessIdentity|null>;pool:()=>Pool;account:(uid:string)=>Promise<Account>;accounts:(uids:string[])=>Promise<{users:{uid:string;email?:string}[]}>;now?:()=>number};
export function createAccessHandlers(deps:Dependencies){
 const {env,identity,pool:connect,account:loadAccount,accounts:loadAccounts,now=Date.now}=deps;
function allowed(request:Request) {
  const origin=configuredAdminOrigin(env.ADMIN_SITE_ORIGIN);
  return !!origin && request.headers.get("origin")===origin;
}
function failure(error:unknown,headers:Record<string,string>) {
  const e=error instanceof AccessError?error:new AccessError("MASTER_UNAVAILABLE",503);
  return Response.json({error:e.code},{status:e.status,headers});
}
async function GET(request:Request) {
  const headers=adminCors(request,"GET",env.ADMIN_SITE_ORIGIN);
  if(!allowed(request))return failure(new AccessError("ADMIN_ORIGIN_NOT_ALLOWED"),headers);
  try {
    const user=await identity(request);
    if(!user)return failure(new AccessError("SIGN_IN_REQUIRED",401),headers);
    const pool=connect(),status=await accessStatus(pool,user,env,now());
    if(!status.isMaster)return Response.json(status,{headers});
    const details=await accessMembers(pool,user);
    // The authenticated master can read emails for this shop only. Never serialize full UserRecords or secrets.
    const ids=[...new Set(details.members.map(m=>String(m.user_uid)))];
    let profiles:Map<string,{uid:string;email?:string}>|null=null;
    let lookupTimer:ReturnType<typeof setTimeout>|undefined;
    try{
      const result=ids.length?await Promise.race([loadAccounts(ids),new Promise<never>((_resolve,reject)=>{lookupTimer=setTimeout(()=>reject(Error("PROFILE_LOOKUP_TIMEOUT")),5000)})]):{users:[]};
      profiles=new Map(result.users.map(p=>[p.uid,p]));
    }catch{/* Keep role management usable if Firebase profile lookup is unavailable. */}
    finally{clearTimeout(lookupTimer)}
    const members=details.members.map(m=>{const p=profiles?.get(m.user_uid);return {...m,email:p?.email||null,
      emailStatus:profiles?(p?(p.email?"available":"not_provided"):"not_found"):"unavailable"}});
    return Response.json({...status,...details,members},{headers});
  } catch(e) {return failure(e,headers)}
}
async function POST(request:Request) {
  const headers=adminCors(request,"POST",env.ADMIN_SITE_ORIGIN);
  if(!allowed(request))return failure(new AccessError("ADMIN_ORIGIN_NOT_ALLOWED"),headers);
  try {
    const user=await identity(request);
    if(!user)return failure(new AccessError("SIGN_IN_REQUIRED",401),headers);
    if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new AccessError("INVALID_INPUT",400);
    // Limit streamed input before buffering; setup passwords and account IDs never reach logs/URLs.
    const reader=request.body?.getReader(); if(!reader)throw new AccessError("INVALID_INPUT",400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new AccessError("INVALID_INPUT",400)}chunks.push(value)}
    let parsed;try{parsed=accessInput.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))}catch{throw new AccessError("INVALID_INPUT",400)}
    if(!parsed.success)throw new AccessError("INVALID_INPUT",400);
    const input=parsed.data,pool=connect();
    if(input.action==="bootstrap")return Response.json(await bootstrapMaster(pool,user,input,env,now()),{headers});
    const master=await requireMaster(pool,user);
    if(!recentGoogle(user,now()))throw new AccessError("RECENT_LOGIN_REQUIRED");
    if(input.action==="lookup" || input.active) {
      let target;try{target=await loadAccount(input.uid)}catch(e){
        if((e as {code?:string}).code==="auth/user-not-found")throw new AccessError("ACCOUNT_NOT_FOUND",404);
        throw e;
      }
      if(target.disabled)throw new AccessError("ACCOUNT_DISABLED",409);
      if(!target.providerData.length && !/^social:(kakao|naver):[a-f0-9]{64}$/.test(target.uid))throw new AccessError("ACCOUNT_LOGIN_REQUIRED",409);
      if(input.action==="lookup")return Response.json({account:{uid:target.uid,email:target.email||null,displayName:target.displayName||null,
        providers:target.providerData.map(p=>p.providerId),memberships:await targetMemberships(pool,master,target.uid)}},{headers});
    }
    return Response.json(await setAccess(pool,user,input,now()),{headers});
  } catch(e) {return failure(e,headers)}
}
function OPTIONS(request:Request) {
  // Both reads and writes use the same endpoint; the requested method is individually checked.
  return adminOptions(request,request.headers.get("access-control-request-method")==="GET"?"GET":"POST",env.ADMIN_SITE_ORIGIN);
}

return {GET,POST,OPTIONS};
}
