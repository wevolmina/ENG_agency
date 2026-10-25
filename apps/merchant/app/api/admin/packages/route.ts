import {adminCors,adminOptions,adminOriginAllowed} from "../../../../lib/admin-http";
import {authorizedStaff} from "../../../../lib/staff";
import {setPackageActive} from "../../../../lib/catalog";
import {getPool} from "../../../../lib/mysql";
import {z} from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const input=z.object({id:z.literal("bedroom-lighting"),active:z.boolean(),version:z.number().int().positive()}).strict();
export async function POST(request:Request){
 const headers=adminCors(request,"POST");
 if(!adminOriginAllowed(request))return Response.json({error:"ADMIN_ORIGIN_NOT_ALLOWED"},{status:403,headers});
 try{
  const staff=await authorizedStaff(request,"admin");if(!staff)return Response.json({error:"ADMIN_ACCESS_REQUIRED"},{status:403,headers});
  const text=await request.text();if(Buffer.byteLength(text)>1024)return Response.json({error:"INVALID_INPUT"},{status:400,headers});
  let body;try{body=input.safeParse(JSON.parse(text))}catch{return Response.json({error:"INVALID_INPUT"},{status:400,headers})}
  if(!body.success)return Response.json({error:"INVALID_INPUT"},{status:400,headers});
  await setPackageActive(getPool(),staff.uid,staff.merchantId,body.data.id,body.data.active,body.data.version);
  return Response.json({ok:true},{headers});
 }catch(e){const code=e instanceof Error?e.message:"";return Response.json({error:code==="VERSION_CONFLICT"?code:"UPDATE_UNAVAILABLE"},{status:code==="VERSION_CONFLICT"?409:503,headers})}
}

export function OPTIONS(request:Request){return adminOptions(request,"POST")}
