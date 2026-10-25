import {pathToFileURL} from "node:url";

// Return names and reasons only. Never include values or credential JSON in logs.
export function staticDeployErrors(target, env = process.env) {
  const errors = [];
  if (!["firebase", "cloudflare"].includes(target)) return ["target must be firebase or cloudflare"];
  for (const name of ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"]) {
    if (!env[name]?.trim() || /placeholder|YOUR_|CHANGE_ME|기존_|실제_|같은_/i.test(env[name])) errors.push(`${name}: missing or placeholder`);
  }
  if (env.VITE_FIREBASE_PROJECT_ID !== "paybridge-mock") errors.push("VITE_FIREBASE_PROJECT_ID: wrong project");
  if (env.VITE_FIREBASE_AUTH_DOMAIN !== "paybridge-mock.firebaseapp.com") errors.push("VITE_FIREBASE_AUTH_DOMAIN: wrong auth domain");
  if (target === "firebase") {
    try {
      const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_PAYBRIDGE_MOCK || "{}");
      if (account.project_id !== "paybridge-mock" || account.type !== "service_account" || !account.client_email || !account.private_key) {
        errors.push("FIREBASE_SERVICE_ACCOUNT_PAYBRIDGE_MOCK: missing fields or wrong project");
      }
    } catch {
      errors.push("FIREBASE_SERVICE_ACCOUNT_PAYBRIDGE_MOCK: invalid JSON");
    }
  } else {
    if (!env.CLOUDFLARE_API_TOKEN?.trim()) errors.push("CLOUDFLARE_API_TOKEN: missing");
    if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || "")) errors.push("CLOUDFLARE_ACCOUNT_ID: missing or invalid account ID");
    if (env.VITE_STAFF_API_ORIGIN !== "https://paybridge-mock.vercel.app") errors.push("VITE_STAFF_API_ORIGIN: wrong API origin");
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = staticDeployErrors(process.argv[2]);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Static deployment configuration is present and targets paybridge-mock.");
  }
}
