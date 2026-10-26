import {pathToFileURL} from "node:url";
export function staticDeployErrors(target,env=process.env){
 const errors=[];
 if(!["firebase","cloudflare"].includes(target))return ["target must be firebase or cloudflare"];
 for(const name of ["VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN","VITE_FIREBASE_PROJECT_ID","VITE_FIREBASE_APP_ID","VITE_STAFF_API_ORIGIN"])
  if(!env[name]?.trim()||/placeholder|YOUR_|CHANGE_ME/i.test(env[name]))errors.push(name+": missing or placeholder");
 if(!/^https:\/\/[^/]+$/.test(env.VITE_STAFF_API_ORIGIN||""))errors.push("VITE_STAFF_API_ORIGIN: exact HTTPS origin required");
 if(env.VITE_FIREBASE_PROJECT_ID==="paybridge-mock")errors.push("VITE_FIREBASE_PROJECT_ID: old project forbidden");
 if(env.VITE_FIREBASE_AUTH_DOMAIN!==env.VITE_FIREBASE_PROJECT_ID+".firebaseapp.com")errors.push("VITE_FIREBASE_AUTH_DOMAIN: wrong auth domain");
 if(target==="firebase"){
  try{const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||"{}");
   if(account.project_id!==env.VITE_FIREBASE_PROJECT_ID||account.type!=="service_account"||!account.client_email||!account.private_key)
    errors.push("FIREBASE_SERVICE_ACCOUNT: missing fields or wrong project");
  }catch{errors.push("FIREBASE_SERVICE_ACCOUNT: invalid JSON")}
 }else{
  if(!env.CLOUDFLARE_API_TOKEN?.trim())errors.push("CLOUDFLARE_API_TOKEN: missing");
  if(!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID||""))errors.push("CLOUDFLARE_ACCOUNT_ID: missing or invalid account ID");
 }
 return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const errors=staticDeployErrors(process.argv[2]);
 if(errors.length){errors.forEach(error=>console.error(error));process.exitCode=1}
 else console.log("New deployment configuration validated; no secret values logged.");
}
