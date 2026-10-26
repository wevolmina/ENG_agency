import type {Pool} from "./db";
import {configuredAdminOrigin} from "./admin-http";
import {AccessError,applicationInput,applyForAccess,ownApplications,type AccessIdentity} from "./staff-access";
type Account={uid:string;email?:string;displayName?:string;disabled:boolean;providerData:{providerId:string}[]};
type Dependencies={env:Record<string,string|undefined>;identity:(request:Request)=>Promise<AccessIdentity|null>;pool:()=>Pool;account:(uid:string)=>Promise<Account>};
export function createRequestHandlers(deps:Dependencies) {
  function allowed(request:Request) {
    const origin=request.headers.get("origin");
    return origin===new URL(request.url).origin||!!origin&&origin===configuredAdminOrigin(deps.env.ADMIN_SITE_ORIGIN)||request.method==="GET"&&origin===null;
  }
  function headers(request:Request):Record<string,string> {
    const origin=request.headers.get("origin");
    return {"Cache-Control":"private, no-store",Vary:"Origin","Access-Control-Allow-Methods":"GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":"Authorization, Content-Type",...(origin&&allowed(request)?{"Access-Control-Allow-Origin":origin}:{})};
  }
  function failure(request:Request,error:unknown) {
    const e=error instanceof AccessError?error:new AccessError("APPLICATION_UNAVAILABLE",503);
    return Response.json({error:e.code},{status:e.status,headers:headers(request)});
  }
  async function handle(request:Request) {
    if(!allowed(request))return failure(request,new AccessError("APPLICATION_ORIGIN_NOT_ALLOWED"));
    try {
      const user=await deps.identity(request);
      if(!user)throw new AccessError("SIGN_IN_REQUIRED",401);
      if(request.method==="GET")return Response.json(await ownApplications(deps.pool(),user),{headers:headers(request)});
      if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new AccessError("INVALID_INPUT",400);
      const reader=request.body?.getReader();if(!reader)throw new AccessError("INVALID_INPUT",400);
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();throw new AccessError("INVALID_INPUT",400)}chunks.push(value)}
      let parsed;try{parsed=applicationInput.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))}catch{throw new AccessError("INVALID_INPUT",400)}
      if(!parsed.success)throw new AccessError("INVALID_INPUT",400);
      const profile=await deps.account(user.uid);
      if(profile.disabled)throw new AccessError("ACCOUNT_DISABLED",409);
      if(!profile.providerData.length&&!/^social:(kakao|naver):[a-f0-9]{64}$/.test(profile.uid))throw new AccessError("ACCOUNT_LOGIN_REQUIRED",409);
      return Response.json(await applyForAccess(deps.pool(),user,parsed.data.role,profile),{headers:headers(request)});
    }catch(e){return failure(request,e)}
  }
  return {GET:handle,POST:handle,OPTIONS(request:Request){
    const method=request.headers.get("access-control-request-method");
    const names=(request.headers.get("access-control-request-headers")||"").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
    return new Response(null,{status:allowed(request)&&["GET","POST"].includes(method||"")&&names.every(s=>["authorization","content-type"].includes(s))?204:403,headers:headers(request)});
  }};
}
