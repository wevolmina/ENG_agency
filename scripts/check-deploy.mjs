import {existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const checks=[];
for(const [name,path,keys] of [
  ["고객 Firebase 설정","apps/customer/.env.local",["VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN","VITE_FIREBASE_PROJECT_ID","VITE_FIREBASE_APP_ID"]],
  ["판매자 서버 설정","apps/merchant/.env.local",["NEXT_PUBLIC_FIREBASE_API_KEY","NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN","NEXT_PUBLIC_FIREBASE_PROJECT_ID","NEXT_PUBLIC_FIREBASE_APP_ID","FIREBASE_PROJECT_ID","FIREBASE_CLIENT_EMAIL","FIREBASE_PRIVATE_KEY","MYSQL_HOST","MYSQL_USER","MYSQL_PASSWORD","MYSQL_DATABASE","SYNC_SHARED_SECRET"]],
  ["Firebase 동기화 URL","functions/.env",["SYNC_API_URL"]]
]){
  const file=resolve(root,path);const values=existsSync(file)?Object.fromEntries(readFileSync(file,"utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).trim()];})):{};
  const missing=keys.filter(k=>!values[k]);checks.push({check:name,status:missing.length?"미설정":"설정됨",missing});
}
for(const [name,path] of [["설치된 패키지","node_modules"],["Firebase 프로젝트 연결",".firebaserc"],["Vercel 프로젝트 연결",".vercel/project.json"]])checks.push({check:name,status:existsSync(resolve(root,path))?"있음":"없음"});
console.log(JSON.stringify({note:"값은 출력하지 않습니다. 원격 계정 권한·DB 연결·Secret Manager 값은 별도 확인이 필요합니다.",checks},null,2));
if(checks.some(c=>["미설정","없음"].includes(c.status)))process.exitCode=1;
