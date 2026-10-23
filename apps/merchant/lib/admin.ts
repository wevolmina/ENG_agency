import {cert, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {merchantFromClaims} from "../../../functions/src/domain";

export function adminAuth() {
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if (!projectId) throw new Error("AUTH_CONFIG_MISSING");
  const app=getApps()[0] || initializeApp(clientEmail&&privateKey?{projectId,credential:cert({projectId,clientEmail,privateKey})}:{projectId});
  return getAuth(app);
}
export async function authorizedUser(request: Request) {
  const token=request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if(!token) return null;
  try {
    const claims=await adminAuth().verifyIdToken(token);
    const key=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;if(!key)return null;
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!response.ok)return null;
    const user=(await response.json()).users?.[0];
    if(!user||user.localId!==claims.uid||user.disabled===true||!/^\d+$/.test(user.validSince)||Number(user.validSince)>claims.auth_time)return null;
    return {uid:claims.uid,claims,token};
  }
  catch {return null;}
}
export async function authorizedMerchant(request:Request){const user=await authorizedUser(request);return user?merchantFromClaims(user.claims):null;}
