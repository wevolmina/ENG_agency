import {cert, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {merchantFromClaims} from "../../../functions/src/domain";

export function adminAuth() {
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("AUTH_CONFIG_MISSING");
  const app=getApps()[0] || initializeApp({credential:cert({projectId,clientEmail,privateKey})});
  return getAuth(app);
}
export async function authorizedMerchant(request: Request) {
  const token=request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if(!token) return null;
  try {return merchantFromClaims(await adminAuth().verifyIdToken(token,true));}
  catch {return null;}
}
