import {adminCors,adminOptions,adminOriginAllowed} from "../../../../lib/admin-http";
import type {RowDataPacket} from "../../../../lib/db";
import {authorizedStaff} from "../../../../lib/staff";
import {spaceCatalog} from "../../../../lib/catalog";
import {getPool} from "../../../../lib/db";
import {merchantPayments} from "../../../../lib/payments";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const headers=adminCors(request,"GET");
 if(!adminOriginAllowed(request))return Response.json({error:"ADMIN_ORIGIN_NOT_ALLOWED"},{status:403,headers});
 try{
  const staff=await authorizedStaff(request,"admin");if(!staff)return Response.json({error:"ADMIN_ACCESS_REQUIRED"},{status:403,headers});
  const pool=getPool();
  const [roles]=await pool.execute<RowDataPacket[]>("SELECT role,COUNT(*) AS count FROM staff_memberships WHERE merchant_id=? AND active=TRUE GROUP BY role",[staff.merchantId]);
  const [audit]=await pool.execute<RowDataPacket[]>("SELECT a.id,a.product_id,a.old_active,a.new_active,a.created_at FROM admin_audit_logs a JOIN packages p ON p.product_id=a.product_id WHERE p.merchant_id=? ORDER BY a.id DESC LIMIT 20",[staff.merchantId]);
  return Response.json({...(await merchantPayments(pool,staff.merchantId)),packages:await spaceCatalog(pool,true),roles,audit,mode:"mock"},{headers});
 }catch{return Response.json({error:"ADMIN_UNAVAILABLE"},{status:503,headers})}
}

export function OPTIONS(request:Request){return adminOptions(request,"GET")}
