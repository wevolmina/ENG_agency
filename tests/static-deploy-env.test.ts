import test from "node:test";
import assert from "node:assert/strict";
import {staticDeployErrors} from "../scripts/check-static-deploy-env.mjs";

const publicConfig = {
  VITE_FIREBASE_API_KEY: "example-public-key",
  VITE_FIREBASE_AUTH_DOMAIN: "eng-agency-test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "eng-agency-test",
  VITE_FIREBASE_APP_ID: "example-public-app-id",
  VITE_STAFF_API_ORIGIN:"https://eng-agency-test.vercel.app",
};
const account = (project_id = "eng-agency-test") => JSON.stringify({type:"service_account",project_id,client_email:"fixture@example.invalid",private_key:"fixture-not-a-real-key"});

test("production Hosting rejects credentials for a different Firebase project", () => {
  assert.deepEqual(staticDeployErrors("firebase", {...publicConfig,FIREBASE_SERVICE_ACCOUNT:account()}), []);
  assert.match(staticDeployErrors("firebase", {...publicConfig,FIREBASE_SERVICE_ACCOUNT:account("another-project")}).join(), /wrong project/);
});

test("production configuration rejects absent build settings before deployment", () => {
  const errors = staticDeployErrors("firebase", {});
  assert(errors.some(error => error.startsWith("VITE_FIREBASE_API_KEY:")));
  assert(errors.some(error => error.startsWith("FIREBASE_SERVICE_ACCOUNT:")));
});

test("Cloudflare requires a specific account, token, and existing API origin", () => {
  const env = {...publicConfig,CLOUDFLARE_API_TOKEN:"fixture-secret",CLOUDFLARE_ACCOUNT_ID:"a".repeat(32),VITE_STAFF_API_ORIGIN:"https://eng-agency-test.vercel.app"};
  assert.deepEqual(staticDeployErrors("cloudflare", env), []);
  assert(staticDeployErrors("cloudflare", {...env,VITE_STAFF_API_ORIGIN:"http://another.example"}).some(error => error.startsWith("VITE_STAFF_API_ORIGIN:")));
  assert(staticDeployErrors("cloudflare", {...env,CLOUDFLARE_API_TOKEN:""}).some(error => error.startsWith("CLOUDFLARE_API_TOKEN:")));
});

test("invalid credential JSON and placeholders do not leak credential values", () => {
  const secret = "sensitive-fixture-that-must-not-appear-in-errors";
  const errors = staticDeployErrors("firebase", {...publicConfig,VITE_FIREBASE_API_KEY:"YOUR_KEY",FIREBASE_SERVICE_ACCOUNT:secret});
  assert(errors.some(error => error.includes("placeholder")));
  assert(errors.some(error => error.includes("invalid JSON")));
  assert(!errors.join().includes(secret));
});
