import type {RowDataPacket} from "mysql2/promise";
import {authorizedStaff} from "../../../../lib/staff";
import {spaceCatalog} from "../../../../lib/catalog";
import {getPool} from "../../../../lib/mysql";
import {merchantPayments} from "../../../../lib/payments";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const staff=await authorizedStaff(request,"admin");if(!staff)return Response.json({error:"ADMIN_ACCESS_REQUIRED"},{status:403,headers});
  const pool=getPool();
  const [roles]=await pool.execute<RowDataPacket[]>("SELECT role,COUNT(*) AS count FROM staff_memberships WHERE merchant_id=? AND active=TRUE GROUP BY role",[staff.merchantId]);
  const [audit]=await pool.execute<RowDataPacket[]>("SELECT a.id,a.product_id,a.old_active,a.new_active,a.created_at FROM admin_audit_logs a JOIN packages p ON p.product_id=a.product_id WHERE p.merchant_id=? ORDER BY a.id DESC LIMIT 20",[staff.merchantId]);
  return Response.json({...(await merchantPayments(pool,staff.merchantId)),packages:await spaceCatalog(pool,true),roles,audit,mode:"mock"},{headers});
 }catch{return Response.json({error:"ADMIN_UNAVAILABLE"},{status:503,headers})}
}
