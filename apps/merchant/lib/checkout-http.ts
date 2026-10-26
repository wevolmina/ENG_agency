import {authorizedUser} from "./admin";
import {cors,options} from "./http";
import {checkoutService} from "./order-intake";
import {orderTask} from "./order-service";
export {options};
export async function submitCheckout(request:Request,kind:"single"|"cart"){
 const headers=cors(request);
 const user=await authorizedUser(request);
 if(!user)return Response.json({error:"AUTH_REQUIRED"},{status:401,headers});
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  return Response.json({error:"INVALID_INPUT"},{status:400,headers});
 const reader=request.body?.getReader();
 if(!reader)return Response.json({error:"INVALID_INPUT"},{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
  if(size>2048){await reader.cancel();return Response.json({error:"INPUT_TOO_LARGE"},{status:413,headers})}chunks.push(value);}
 let task;
 try{task=orderTask(user.uid,kind,JSON.parse(Buffer.concat(chunks).toString("utf8")))}
 catch{return Response.json({error:"INVALID_INPUT"},{status:400,headers})}
 try{
  const result=await checkoutService().submit(task);
  return Response.json(result.body,{status:result.status,headers});
 }catch(e){
  const conflict=e instanceof Error&&e.message==="REQUEST_CONFLICT";
  return Response.json({error:conflict?"REQUEST_CONFLICT":"INTAKE_UNAVAILABLE"},{status:conflict?409:503,headers});
 }
}
