import {applicationDefault,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
const [uid,merchantId]=process.argv.slice(2);
if(!uid||!merchantId||!/^[a-z0-9-]{1,64}$/.test(merchantId))throw new Error("사용법: npm run merchant:grant -- FIREBASE_UID studio-mina");
initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
const auth=getAuth();const user=await auth.getUser(uid);
await auth.setCustomUserClaims(uid,{...user.customClaims,merchant_id:merchantId});
console.log("판매자 권한 등록 완료. 해당 계정으로 다시 로그인하세요.");
