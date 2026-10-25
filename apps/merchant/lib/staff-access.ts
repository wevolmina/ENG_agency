import {createHash, timingSafeEqual} from "node:crypto";
import type {Pool, PoolConnection, RowDataPacket} from "mysql2/promise";
import {z} from "zod";

export type AccessIdentity = {
  uid: string; email: string | null; emailVerified: boolean;
  claims: {email?: string; email_verified?: boolean; auth_time?: number; firebase?: {sign_in_provider?: string}};
};
type Env = Record<string, string | undefined>;
type Sql = Pick<Pool, "execute"> | Pick<PoolConnection, "execute">;
export type Role = "merchant" | "admin";
type Master = {user_uid: string | null; merchant_id: string | null; failed_attempts: number; locked_until_ms: number};
export class AccessError extends Error {
  constructor(public code: string, public status = 403) {super(code)}
}
const uid = z.string().min(1).max(128).regex(/^[^\s\x00-\x1f\x7f]+$/);
export const accessInput = z.discriminatedUnion("action", [
  z.object({action:z.literal("bootstrap"),password:z.string().min(1).max(256),includeMerchant:z.boolean()}).strict(),
  z.object({action:z.literal("lookup"),uid}).strict(),
  z.object({action:z.literal("set"),uid,role:z.enum(["merchant","admin"]),active:z.boolean(),expectedActive:z.boolean().nullable()}).strict(),
]);
export const accessSchema = [
  `CREATE TABLE IF NOT EXISTS staff_master_setup (
    id TINYINT PRIMARY KEY,
    user_uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until_ms BIGINT NOT NULL DEFAULT 0,
    completed_at TIMESTAMP(3) NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS staff_access_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    target_uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    role ENUM('merchant','admin') NOT NULL,
    before_active BOOLEAN NULL,
    after_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB`,
];
function setupConfig(env: Env) {
  const email = env.MASTER_SETUP_EMAIL?.trim().toLowerCase();
  const merchant = env.MASTER_SETUP_MERCHANT_ID;
  const password = env.MASTER_SETUP_PASSWORD;
  return email && z.string().email().safeParse(email).success && merchant && /^[a-z0-9-]{1,64}$/.test(merchant) &&
    password && password.length >= 5 && password.length <= 256 ? {email,merchant,password} : null;
}
export function googleIdentity(user: AccessIdentity) {
  return user.emailVerified && user.claims.email_verified === true &&
    user.claims.firebase?.sign_in_provider === "google.com" && typeof user.email === "string" &&
    user.email.toLowerCase() === user.claims.email?.toLowerCase();
}
export function recentGoogle(user: AccessIdentity, now = Date.now()) {
  const authTime = user.claims.auth_time;
  return googleIdentity(user) && typeof authTime === "number" && Number.isFinite(authTime) &&
    authTime * 1000 <= now + 30000 && now - authTime * 1000 <= 5 * 60 * 1000;
}
async function masterRecord(db: Sql, lock = false): Promise<Master | null> {
  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT user_uid,merchant_id,failed_attempts,locked_until_ms FROM staff_master_setup WHERE id=1" + (lock?" FOR UPDATE":""));
    return rows[0] as Master || null;
  } catch(e) {
    if (!lock && (e as {code?:string}).code === "ER_NO_SUCH_TABLE") return null;
    throw e;
  }
}
async function membership(db: Sql, userUid: string, role: Role, lock = false) {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT merchant_id,active FROM staff_memberships WHERE BINARY user_uid=BINARY ? AND role=?" + (lock?" FOR UPDATE":""), [userUid,role]);
  return rows[0] as {merchant_id:string;active:number|boolean} | undefined;
}
export async function requireMaster(db: Sql, user: AccessIdentity, lock = false) {
  if (!googleIdentity(user)) throw new AccessError("MASTER_ACCESS_REQUIRED");
  const master = await masterRecord(db,lock);
  if (!master?.user_uid || master.user_uid !== user.uid || !master.merchant_id) throw new AccessError("MASTER_ACCESS_REQUIRED");
  const member = await membership(db,user.uid,"admin",lock);
  if (!member?.active || member.merchant_id !== master.merchant_id) throw new AccessError("MASTER_ACCESS_REQUIRED");
  return {uid:master.user_uid,merchantId:master.merchant_id};
}
export async function accessStatus(pool: Pool, user: AccessIdentity, env: Env, now = Date.now()) {
  const master = await masterRecord(pool);
  const cfg = setupConfig(env);
  const candidate = googleIdentity(user) && !!cfg && user.email!.toLowerCase() === cfg.email;
  let isMaster = false;
  if (master?.user_uid === user.uid && googleIdentity(user)) {
    const member = await membership(pool,user.uid,"admin");
    isMaster = !!member?.active && member.merchant_id === master.merchant_id;
  }
  return {isMaster,canSetup:!master?.user_uid && candidate,needsRecentLogin:(isMaster||candidate)&&!recentGoogle(user,now)};
}
async function audit(db: Sql, actor: string, target: string, merchant: string, role: Role, before: boolean|null, after: boolean) {
  await db.execute("INSERT INTO staff_access_audit (actor_uid,target_uid,merchant_id,role,before_active,after_active) VALUES (?,?,?,?,?,?)",
    [actor,target,merchant,role,before,after]);
}
export async function bootstrapMaster(pool: Pool, user: AccessIdentity, input: {password:string;includeMerchant:boolean}, env: Env, now = Date.now()) {
  const cfg = setupConfig(env);
  if (!cfg) throw new AccessError("MASTER_SETUP_NOT_CONFIGURED",503);
  if (!googleIdentity(user) || user.email!.toLowerCase() !== cfg.email) throw new AccessError("MASTER_ACCESS_REQUIRED");
  if (!recentGoogle(user,now)) throw new AccessError("RECENT_LOGIN_REQUIRED");
  // Only the designated, freshly authenticated Google account can initialize these two new tables.
  for (const statement of accessSchema) await pool.execute(statement);
  const c = await pool.getConnection(); let committed = false;
  try {
    await c.beginTransaction();
    await c.execute("INSERT INTO staff_master_setup (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id");
    const record = await masterRecord(c,true);
    if (!record) throw new AccessError("MASTER_UNAVAILABLE",503);
    if (record.user_uid) throw new AccessError("MASTER_SETUP_CLOSED",409);
    if (Number(record.locked_until_ms)>now) throw new AccessError("SETUP_TRY_LATER",429);
    const supplied = createHash("sha256").update(input.password).digest();
    const expected = createHash("sha256").update(cfg.password).digest();
    if (!timingSafeEqual(supplied,expected)) {
      const failures = (Number(record.locked_until_ms)>0 ? 0 : Number(record.failed_attempts)) + 1;
      await c.execute("UPDATE staff_master_setup SET failed_attempts=?,locked_until_ms=? WHERE id=1",
        [failures,failures>=5?now+15*60*1000:0]);
      await c.commit(); committed = true;
      throw new AccessError(failures>=5?"SETUP_TRY_LATER":"SETUP_PASSWORD_INVALID",failures>=5?429:403);
    }
    // Verify the configured shop exists. No caller can select a different shop.
    const [shops] = await c.execute<RowDataPacket[]>("SELECT merchant_id FROM packages WHERE merchant_id=? LIMIT 1",[cfg.merchant]);
    if (!shops.length) throw new AccessError("MASTER_STORE_NOT_FOUND",409);
    for (const role of (input.includeMerchant?["admin","merchant"]:["admin"]) as Role[]) {
      const member = await membership(c,user.uid,role,true);
      if (member && member.merchant_id!==cfg.merchant) throw new AccessError("ACCOUNT_OTHER_STORE",409);
      if (member) await c.execute("UPDATE staff_memberships SET active=TRUE WHERE BINARY user_uid=BINARY ? AND role=? AND merchant_id=?",[user.uid,role,cfg.merchant]);
      else await c.execute("INSERT INTO staff_memberships (user_uid,merchant_id,role,active) VALUES (?,?,?,TRUE)",[user.uid,cfg.merchant,role]);
      await audit(c,user.uid,user.uid,cfg.merchant,role,member?!!member.active:null,true);
    }
    await c.execute("UPDATE staff_master_setup SET user_uid=?,merchant_id=?,failed_attempts=0,locked_until_ms=0,completed_at=CURRENT_TIMESTAMP(3) WHERE id=1",[user.uid,cfg.merchant]);
    await c.commit(); committed = true;
    return {ok:true};
  } catch(e) {if(!committed) await c.rollback(); throw e;} finally {c.release()}
}
export async function accessMembers(pool: Pool, user: AccessIdentity) {
  const master = await requireMaster(pool,user);
  const [members] = await pool.execute<RowDataPacket[]>("SELECT user_uid,role,active FROM staff_memberships WHERE merchant_id=? ORDER BY user_uid,role LIMIT 100",[master.merchantId]);
  const [history] = await pool.execute<RowDataPacket[]>("SELECT id,actor_uid,target_uid,role,before_active,after_active,created_at FROM staff_access_audit WHERE merchant_id=? ORDER BY id DESC LIMIT 20",[master.merchantId]);
  return {masterUid:master.uid,merchantId:master.merchantId,members,history};
}
export async function targetMemberships(pool: Pool, master: {merchantId:string}, targetUid: string) {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT role,active,merchant_id FROM staff_memberships WHERE BINARY user_uid=BINARY ?",[targetUid]);
  return rows.map(r=>({role:r.role,active:!!r.active,otherStore:r.merchant_id!==master.merchantId}));
}
export async function setAccess(pool: Pool, user: AccessIdentity,
  input: {uid:string;role:Role;active:boolean;expectedActive:boolean|null}, now = Date.now()) {
  if (!recentGoogle(user,now)) throw new AccessError("RECENT_LOGIN_REQUIRED");
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const master = await requireMaster(c,user,true);
    if (input.uid===master.uid && input.role==="admin" && !input.active) throw new AccessError("MASTER_ADMIN_PROTECTED",409);
    const member = await membership(c,input.uid,input.role,true);
    if (member && member.merchant_id!==master.merchantId) throw new AccessError("ACCOUNT_OTHER_STORE",409);
    const before = member?!!member.active:null;
    if (before!==input.expectedActive) throw new AccessError("ACCESS_VERSION_CONFLICT",409);
    if (!member && !input.active) throw new AccessError("ACCESS_VERSION_CONFLICT",409);
    if (before===input.active) {await c.commit(); return {ok:true}}
    if (member) await c.execute("UPDATE staff_memberships SET active=? WHERE BINARY user_uid=BINARY ? AND role=? AND merchant_id=?",[input.active,input.uid,input.role,master.merchantId]);
    else await c.execute("INSERT INTO staff_memberships (user_uid,merchant_id,role,active) VALUES (?,?,?,?)",[input.uid,master.merchantId,input.role,input.active]);
    await audit(c,user.uid,input.uid,master.merchantId,input.role,before,input.active);
    await c.commit(); return {ok:true};
  } catch(e) {await c.rollback(); throw e;} finally {c.release()}
}
