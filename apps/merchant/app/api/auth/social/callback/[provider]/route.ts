import {finishSocialLogin} from "../../../../../../lib/social-auth";
import {adminAuth} from "../../../../../../lib/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET(request: Request, context: {params: Promise<{provider: string}>}) {
  const {provider} = await context.params;
  return finishSocialLogin(request, provider, process.env,
    (uid, claims) => adminAuth().createCustomToken(uid, claims));
}
