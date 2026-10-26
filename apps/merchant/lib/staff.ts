import type {Pool,RowDataPacket} from "./db";
import {getPool} from "./db";
import {authorizedUser} from "./admin";

export async function staffMembership(pool:Pool,uid:string,role:"merchant"|"admin") {
 const [rows]=await pool.execute<RowDataPacket[]>(
  "SELECT merchant_id FROM staff_memberships WHERE user_uid=? AND role=? AND active=TRUE",[uid,role]);
 return typeof rows[0]?.merchant_id==="string"?rows[0].merchant_id:null;
}
export async function authorizedStaff(request:Request,role:"merchant"|"admin") {
 const user=await authorizedUser(request);if(!user)return null;
 const merchantId=await staffMembership(getPool(),user.uid,role);
 return merchantId?{uid:user.uid,merchantId}:null;
}
