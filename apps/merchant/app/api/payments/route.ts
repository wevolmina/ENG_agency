import {authorizedStaff} from "../../../lib/staff";
import {getPool} from "../../../lib/db";
import {merchantPayments} from "../../../lib/payments";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try {
   const staff=await authorizedStaff(request,"merchant");
   if(!staff) return Response.json({error:"MERCHANT_ACCESS_REQUIRED"},{status:403,headers:{"Cache-Control":"no-store"}});
   return Response.json(await merchantPayments(getPool(),staff.merchantId),{headers:{"Cache-Control":"private, no-store"}});}
  catch {return Response.json({error:"DATABASE_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
