import {adminAuth,authorizedUser} from "../../../../lib/admin";
import {getPool} from "../../../../lib/mysql";
import {createRequestHandlers} from "../../../../lib/staff-requests-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const handlers=createRequestHandlers({env:process.env,identity:authorizedUser,pool:getPool,account:uid=>adminAuth().getUser(uid)});
export const GET=handlers.GET;
export const POST=handlers.POST;
export const OPTIONS=handlers.OPTIONS;
