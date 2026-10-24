import {authorizedUser} from "../../../lib/admin";
import {getPool} from "../../../lib/mysql";
import {existingOrder,recordRequest,confirmOrder} from "../../../lib/checkout";
import {cors,options} from "../../../lib/http";
import {createInput} from "../../../../../functions/src/domain";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const OPTIONS=options;
export async function POST(request:Request){
 const headers=cors(request),user=await authorizedUser(request);
 if(!user)return Response.json({error:"AUTH_REQUIRED"},{status:401,headers});
 const text=await request.text();if(Buffer.byteLength(text)>2048)return Response.json({error:"INPUT_TOO_LARGE"},{status:413,headers});
 let value;try{value=JSON.parse(text);}catch{return Response.json({error:"INVALID_INPUT"},{status:400,headers});}
 const input=createInput.safeParse(value);if(!input.success)return Response.json({error:"INVALID_INPUT"},{status:400,headers});
 try {
  const pool=getPool();
  const previous=await existingOrder(pool,user.uid,input.data);
  if(previous)return Response.json(previous,{headers});
  await recordRequest(user.token,user.uid,input.data);
  return Response.json(await confirmOrder(pool,user.uid,input.data),{headers});
 }catch(error){const message=error instanceof Error?error.message:"UNAVAILABLE";const conflict=["REQUEST_CONFLICT","PACKAGE_UNAVAILABLE","PACKAGE_CHANGED"].includes(message);console.error("checkout_failed",{requestId:input.data.requestId,code:conflict?message:"DEPENDENCY_UNAVAILABLE"});return Response.json({error:conflict?message:"CHECKOUT_UNAVAILABLE"},{status:conflict?409:503,headers});}
}
