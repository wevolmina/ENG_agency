import {cronAuthorized} from "../../../../lib/cron-auth";
import {checkoutService} from "../../../../lib/order-intake";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 if(!cronAuthorized(request))return Response.json({error:"UNAUTHORIZED"},{status:401,headers});
 try{return Response.json(await checkoutService().reconcile(),{headers})}
 catch{return Response.json({error:"RECONCILE_UNAVAILABLE"},{status:503,headers})}
}
