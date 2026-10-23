import {authorizedMerchant} from "../../../lib/admin";
import {getPool} from "../../../lib/mysql";
import {merchantPayments} from "../../../lib/payments";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const merchantId=await authorizedMerchant(request);
  if(!merchantId) return Response.json({error:"MERCHANT_ACCESS_REQUIRED"},{status:403,headers:{"Cache-Control":"no-store"}});
  try {return Response.json(await merchantPayments(getPool(),merchantId),{headers:{"Cache-Control":"private, no-store"}});}
  catch {return Response.json({error:"MYSQL_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
