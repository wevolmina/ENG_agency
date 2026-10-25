import {adminAuth,authorizedUser} from "../../../../lib/admin";
import {getPool} from "../../../../lib/mysql";
import {createAccessHandlers} from "../../../../lib/staff-access-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const handlers=createAccessHandlers({env:process.env,identity:authorizedUser,pool:getPool,account:uid=>adminAuth().getUser(uid)});
export const GET=handlers.GET;
export const POST=handlers.POST;
export const OPTIONS=handlers.OPTIONS;
