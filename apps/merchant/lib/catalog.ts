import type {Pool,RowDataPacket} from "./db";

export async function spaceCatalog(pool:Pool,includeInactive=false) {
 const [rows]=await pool.execute<RowDataPacket[]>(
  `SELECT p.product_id AS id,p.name,p.description,p.unit_price AS price,p.currency,p.active,p.version,s.space_id AS "spaceId",s.name AS "spaceName" FROM packages p JOIN spaces s ON s.space_id=p.space_id ${includeInactive?"":"WHERE p.active=TRUE"} ORDER BY p.product_id`);
 return rows.map(r=>({...r,price:Number(r.price),active:Boolean(r.active)}));
}
export async function setPackageActive(pool:Pool,actorUid:string,merchantId:string,id:string,active:boolean,version:number) {
 const c=await pool.getConnection();
 try{
  await c.beginTransaction();
  const [rows]=await c.execute<RowDataPacket[]>("SELECT active,version FROM packages WHERE product_id=? AND merchant_id=? FOR UPDATE",[id,merchantId]);
  const row=rows[0];if(!row)throw Error("PACKAGE_NOT_FOUND");
  if(Number(row.version)!==version)throw Error("VERSION_CONFLICT");
  if(Boolean(row.active)!==active){
   await c.execute("UPDATE packages SET active=?,version=version+1 WHERE product_id=? AND merchant_id=?",[active,id,merchantId]);
   await c.execute("INSERT INTO admin_audit_logs (actor_uid,product_id,old_active,new_active) VALUES (?,?,?,?)",[actorUid,id,Boolean(row.active),active]);
  }
  await c.commit();
 }catch(error){await c.rollback();throw error}finally{c.release()}
}
