import {beginSocialLogin} from "../../../../../lib/social-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return beginSocialLogin(request, process.env);
}
