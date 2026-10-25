import test from "node:test";
import assert from "node:assert/strict";
import {beginSocialLogin, exchangeSocialCode, finishSocialLogin, signSocialState,
  socialConfiguration, socialConfigResponse, socialOrigins, socialUid, verifySocialState,
  type SocialEnv} from "../apps/merchant/lib/social-auth";
import {readSocialResult, socialErrorMessage, socialErrorCode} from "../packages/staff-ui/social-policy";
const origin = "https://paybridge-mock.web.app", api = "https://paybridge-mock.vercel.app";
const nonce = "b".repeat(64), secret = "test-only-state-secret-".repeat(3), now = 100000;
const env: SocialEnv = {SOCIAL_AUTH_STATE_SECRET: secret, KAKAO_REST_API_KEY: "kakao-test-id",
  KAKAO_CLIENT_SECRET: "kakao-test-secret", NAVER_CLIENT_ID: "naver-test-id",
  NAVER_CLIENT_SECRET: "naver-test-secret", FIREBASE_PROJECT_ID: "test-project",
  FIREBASE_CLIENT_EMAIL: "fixture@example.invalid", FIREBASE_PRIVATE_KEY: "fixture-not-a-key",
  SOCIAL_GOOGLE_ENABLED: "true", ADMIN_SITE_ORIGIN: "https://paybridge-admin.evolvix.workers.dev",
  NODE_ENV: "production"};
function start(provider = "kakao", extra = "") {
  return beginSocialLogin(new Request(api + "/api/auth/social/start?provider=" + provider +
    "&origin=" + encodeURIComponent(origin) + "&nonce=" + nonce + extra), env, now);
}
function callback(provider = "kakao", overrides = "") {
  const response = start(provider), target = new URL(response.headers.get("location")!);
  return new Request(api + "/api/auth/social/callback/" + provider + "?state=" +
    target.searchParams.get("state") + "&code=fixture-code" + overrides,
    {headers: {cookie: response.headers.get("set-cookie")!.split(";")[0]}});
}
test("social config fails closed, exposes readiness only, exact customer/admin/merchant origins", async () => {
  assert.deepEqual(socialConfiguration({}), {google: false, kakao: false, naver: false});
  assert.equal(socialConfiguration({...env, NAVER_CLIENT_SECRET: ""}).naver, false);
  for (const allowed of [origin, env.ADMIN_SITE_ORIGIN!, api]) {
    const r = socialConfigResponse(new Request(api, {headers: {origin: allowed}}), env);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("access-control-allow-origin"), allowed);
    assert.deepEqual(await r.json(), {google: true, kakao: true, naver: true});
  }
  assert.equal(socialConfigResponse(new Request(api, {headers: {origin: "https://evil.example"}}), env).status, 403);
  assert(!socialOrigins({...env, ADMIN_SITE_ORIGIN: "https://evil.example/path"}).has("https://evil.example"));
  assert(!socialOrigins({...env, ADMIN_SITE_ORIGIN: "http://localhost:3000"}).has("http://localhost:3000"));
});
test("merchant same-origin config works without Origin; other sites and missing metadata stay rejected", async () => {
  const r = socialConfigResponse(new Request(api + "/api/auth/social/config", {
    headers: {"sec-fetch-site": "same-origin"},
  }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {google: true, kakao: true, naver: true});
  assert.match(r.headers.get("cache-control")!, /no-store/);
  assert.match(r.headers.get("vary")!, /Sec-Fetch-Site/);
  for (const site of ["cross-site", "same-site", "none"]) {
    assert.equal(socialConfigResponse(new Request(api, {headers: {"sec-fetch-site": site}}), env).status, 403);
  }
  assert.equal(socialConfigResponse(new Request(api), env).status, 403);
  assert.equal(socialConfigResponse(new Request("https://preview.example", {
    headers: {"sec-fetch-site": "same-origin"},
  }), env).status, 403);
  assert.equal(socialConfigResponse(new Request(api, {headers: {
    origin: "https://evil.example", "sec-fetch-site": "same-origin",
  }}), env).status, 403);
});
test("merchant OAuth returns to the canonical seller origin and never grants a staff role", async () => {
  for (const provider of ["kakao", "naver"] as const) {
    const response = beginSocialLogin(new Request(api + "/api/auth/social/start?provider=" + provider +
      "&origin=" + encodeURIComponent(api) + "&nonce=" + nonce), env, now);
    assert.equal(response.status, 303);
    const target = new URL(response.headers.get("location")!);
    assert.equal(target.searchParams.get("redirect_uri"), api + "/api/auth/social/callback/" + provider);
    const req = new Request(api + "/api/auth/social/callback/" + provider + "?state=" +
      target.searchParams.get("state") + "&code=fixture-code", {headers: {
        cookie: response.headers.get("set-cookie")!.split(";")[0],
      }});
    let calls = 0, claims: unknown;
    const result = await finishSocialLogin(req, provider, env, async (_uid, c) => {
      claims = c; return "header.payload.signature";
    }, async () => Response.json(++calls === 1 ? {access_token: "provider-token"} :
      provider === "kakao" ? {id: 123} : {resultcode: "00", response: {id: "subject"}}), now);
    assert.equal(result.status, 200);
    assert((await result.text()).includes(',"' + api + '")'));
    assert.deepEqual(claims, {social_provider: provider});
  }
});
test("OAuth start binds random state, intended origin and client nonce in secure HttpOnly cookie", () => {
  const r = start(), target = new URL(r.headers.get("location")!);
  assert.equal(r.status, 303);assert.equal(target.origin, "https://kauth.kakao.com");
  assert.equal(target.searchParams.get("redirect_uri"), api + "/api/auth/social/callback/kakao");
  assert(!target.href.includes("kakao-test-secret"));
  const cookie = r.headers.get("set-cookie")!;
  assert.match(cookie, /^__Host-paybridge-social-kakao=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=600"]) assert(cookie.includes(flag));
  const state = verifySocialState(cookie.split(";")[0].split("=")[1], secret, now)!;
  assert.equal(state.origin, origin);assert.equal(state.nonce, nonce);
  assert.equal(state.state, target.searchParams.get("state"));
  assert.notEqual(new URL(start().headers.get("location")!).searchParams.get("state"), state.state);
});
test("reject unknown provider, arbitrary return origin, duplicate params, missing config and wrong API host", () => {
  for (const u of [
    api + "/api/auth/social/start?provider=evil&origin=" + origin + "&nonce=" + nonce,
    api + "/api/auth/social/start?provider=kakao&origin=https://evil.example&nonce=" + nonce,
    "https://preview.example/api/auth/social/start?provider=kakao&origin=" + origin + "&nonce=" + nonce,
  ]) assert.equal(beginSocialLogin(new Request(u), env, now).status, 400);
  assert.equal(start("kakao", "&provider=naver").status, 400);
  assert.equal(beginSocialLogin(new Request(api + "/api/auth/social/start?provider=kakao&origin=" +
    origin + "&nonce=" + nonce), {...env, SOCIAL_AUTH_STATE_SECRET: "short"}, now).status, 503);
});
test("state refuses altered signature/payload, expired/future state and extra identity fields", () => {
  const payload = {provider: "kakao" as const, state: "a".repeat(64), nonce, origin, expires: now + 10000};
  const signed = signSocialState(payload, secret);
  assert(verifySocialState(signed, secret, now));
  assert.equal(verifySocialState(signed + "x", secret, now), null);
  assert.equal(verifySocialState(signed.replace(/^./, "z"), secret, now), null);
  assert.equal(verifySocialState(signed, secret, now + 10001), null);
  assert.equal(verifySocialState(signSocialState({...payload, expires: now + 600001}, secret), secret, now), null);
  assert.equal(verifySocialState(signSocialState({...payload, uid: "existing-admin"} as typeof payload, secret), secret, now), null);
});
test("provider identity is stable and namespaced by provider and app, not email", () => {
  assert.equal(socialUid("kakao", "app", "subject"), socialUid("kakao", "app", "subject"));
  assert.notEqual(socialUid("kakao", "app", "subject"), socialUid("naver", "app", "subject"));
  assert.notEqual(socialUid("kakao", "app", "subject"), socialUid("kakao", "other-app", "subject"));
  assert(socialUid("naver", "app", "subject").length < 128);
});
test("provider code and secret stay in POST body; token stays in profile Authorization header", async () => {
  for (const provider of ["kakao", "naver"] as const) {
    const calls: {url: string; init: RequestInit}[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({url: String(input), init: init!});
      return Response.json(calls.length === 1 ? {access_token: "private-provider-token"} :
        provider === "kakao" ? {id: 123, kakao_account: {email: "admin@example.invalid"}} :
          {resultcode: "00", response: {id: "subject", email: "admin@example.invalid"}});
    };
    const uid = await exchangeSocialCode(provider, "private-code", "state", env, fetcher);
    assert.match(uid, new RegExp("^social:" + provider + ":"));
    assert.equal(calls[0].init.method, "POST");
    assert(!calls[0].url.includes("private-code") && !calls[0].url.includes("secret"));
    const body = new URLSearchParams(String(calls[0].init.body));
    assert.equal(body.get("code"), "private-code");
    assert.equal(body.get("client_secret"), provider + "-test-secret");
    assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer private-provider-token");
    assert.equal(calls[0].init.redirect, "error");
    assert.equal(calls[1].init.redirect, "error");
    assert(!uid.includes("admin@example.invalid"));
  }
});
test("invalid provider profile or missing token never yields an identity", async () => {
  for (const bad of [{resultcode: "01", response: {id: "x"}}, {resultcode: "00", response: {}}, {id: -1}]) {
    let n = 0;
    await assert.rejects(exchangeSocialCode("naver", "code", "state", env, async () =>
      Response.json(++n === 1 ? {access_token: "token"} : bad)), /SOCIAL_PROFILE_FAILED/);
  }
  await assert.rejects(exchangeSocialCode("kakao", "code", "state", env, async () =>
    Response.json({error: "no-token"})), /SOCIAL_TOKEN_EXCHANGE_FAILED/);
});
test("callback rejects missing/tampered/wrong state before any provider call or token mint", async () => {
  let calls = 0;
  const mint = async () => {calls++; return "never";}, fetcher: typeof fetch = async () => {calls++; return Response.json({});};
  const good = callback();
  for (const req of [new Request(good.url), new Request(good.url + "&state=another", {headers: good.headers}),
    new Request(good.url.replace(/state=[^&]+/, "state=wrong"), {headers: good.headers})]) {
    assert.equal((await finishSocialLogin(req, "kakao", env, mint, fetcher, now)).status, 400);
  }
  assert.equal((await finishSocialLogin(good, "naver", env, mint, fetcher, now)).status, 400);
  assert.equal(calls, 0);
});
test("valid callback mints provider-only claim, exact popup target, nonce and noncacheable token response", async () => {
  let n = 0, got: unknown;
  const r = await finishSocialLogin(callback(), "kakao", env, async (uid, claims) => {
    got = {uid, claims};return "header.payload.signature";
  }, async () => Response.json(++n === 1 ? {access_token: "provider-token"} : {id: 123}), now);
  const text = await r.text();
  assert.equal(r.status, 200);
  assert.deepEqual(got, {uid: socialUid("kakao", "kakao-test-id", "123"), claims: {social_provider: "kakao"}});
  assert(text.includes('"nonce":"' + nonce + '"'));assert(text.includes(',"' + origin + '")'));
  assert(!text.includes("provider-token"));assert(!text.includes('"admin"'));
  assert.match(r.headers.get("content-security-policy")!, /script-src 'nonce-/);
  assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  assert.match(r.headers.get("cache-control")!, /no-store/);
  assert.match(r.headers.get("set-cookie")!, /Max-Age=0/);
  assert(text.includes('history.replaceState(null,"",location.pathname)'));
});
test("cancelled/failed provider replies do not echo tokens, codes or private provider errors", async () => {
  let calls = 0;
  const deny = callback().url.replace("&code=fixture-code", "&error=access_denied");
  const r = await finishSocialLogin(new Request(deny, {headers: callback().headers}),
    "kakao", env, async () => {calls++; return "";}, async () => {calls++; throw Error();}, now);
  // A separately generated state/cookie pair is deliberately invalid.
  assert.equal(r.status, 400);assert.equal(calls, 0);
  const req = callback();
  const cancelled = await finishSocialLogin(new Request(req.url.replace("&code=fixture-code", "&error=access_denied"),
    {headers: req.headers}), "kakao", env, async () => {calls++; return "";}, undefined, now);
  assert((await cancelled.text()).includes("SOCIAL_CANCELLED"));assert.equal(calls, 0);
  const fail = await finishSocialLogin(callback(), "kakao", env, async () => "never",
    async () => {throw Error("private-provider-token-and-secret");}, now);
  const text = await fail.text();
  assert(text.includes("SOCIAL_LOGIN_FAILED"));assert(!text.includes("private-provider-token-and-secret"));
});
test("browser result rejects wrong nonce, unknown fields, malformed token and arbitrary provider errors", () => {
  const good = {type: "paybridge-social-login", nonce, token: "header.payload.signature"};
  assert(readSocialResult(good, nonce));
  assert.equal(readSocialResult(good, "other"), null);
  assert.equal(readSocialResult({...good, uid: "admin"}, nonce), null);
  assert.equal(readSocialResult({...good, token: "not-token"}, nonce), null);
  assert.equal(readSocialResult({...good, error: "SOCIAL_CANCELLED"}, nonce), null);
  assert.equal(readSocialResult({type: good.type, nonce, error: "private-provider-error"}, nonce), null);
  assert.match(socialErrorMessage({code: "auth/popup-blocked"}), /팝업/);
  assert.match(socialErrorMessage({code: "auth/credential-already-in-use"}), /자동으로 합치지/);
  assert(!socialErrorMessage(Error("private-token")).includes("private-token"));
});


test("safe diagnostics distinguish Google domain/provider setup without echoing private payloads",()=>{
 assert.equal(socialErrorCode({code:"auth/unauthorized-domain",message:"private-secret"}),"auth/unauthorized-domain");
 assert.match(socialErrorMessage({code:"auth/unauthorized-domain"}),/허용 도메인/);
 assert.match(socialErrorMessage({code:"auth/operation-not-allowed"}),/활성화/);
 assert.match(socialErrorMessage({code:"auth/custom-token-mismatch"}),/같은 프로젝트/);
 assert.equal(socialErrorCode(Error("private-secret-and-email")),"SOCIAL_LOGIN_FAILED");
 assert(!socialErrorMessage(Error("private-secret-and-email")).includes("private-secret"));
});
test("callback diagnoses token exchange, profile and Firebase mint separately",async()=>{
 const tokenFail=await finishSocialLogin(callback(),"kakao",env,async()=>"never",async()=>Response.json({error:"private-provider-message"},{status:401}),now);
 const tokenText=await tokenFail.text();assert(tokenText.includes("SOCIAL_TOKEN_EXCHANGE_FAILED"));assert(!tokenText.includes("private-provider-message"));
 let calls=0;const profileFail=await finishSocialLogin(callback(),"kakao",env,async()=>"never",async()=>++calls===1?Response.json({access_token:"private-provider-token"}):Response.json({error:"private-profile-message"},{status:403}),now);
 const profileText=await profileFail.text();assert(profileText.includes("SOCIAL_PROFILE_FAILED"));assert(!profileText.includes("private-profile-message"));
 calls=0;const mintFail=await finishSocialLogin(callback(),"kakao",env,async()=>{throw Error("private-PEM")},async()=>Response.json(++calls===1?{access_token:"private-token"}:{id:123}),now);
 const mintText=await mintFail.text();assert(mintText.includes("SOCIAL_FIREBASE_TOKEN_FAILED"));assert(!mintText.includes("private-PEM"));
});
test("provider configuration rejection is not mislabeled as user cancellation",async()=>{
 const req=callback();const result=await finishSocialLogin(new Request(req.url.replace("&code=fixture-code","&error=invalid_client&error_description=private-secret"),{headers:req.headers}),"kakao",env,async()=>"never",async()=>{throw Error("must not call")},now);
 const html=await result.text();assert(html.includes("SOCIAL_PROVIDER_CONFIG_ERROR"));assert(!html.includes("private-secret"));assert(!html.includes("SOCIAL_CANCELLED"));
});
test("browser accepts only whitelisted stage codes with the matching nonce",()=>{
 for(const error of ["SOCIAL_TOKEN_EXCHANGE_FAILED","SOCIAL_PROFILE_FAILED","SOCIAL_FIREBASE_TOKEN_FAILED","SOCIAL_PROVIDER_CONFIG_ERROR"]){
  assert(readSocialResult({type:"paybridge-social-login",nonce,error},nonce));
  assert.equal(readSocialResult({type:"paybridge-social-login",nonce,error},"wrong"),null);
 }
 assert.equal(readSocialResult({type:"paybridge-social-login",nonce,error:"private-provider-error"},nonce),null);
});


test("Kakao token diagnostics expose only documented codes, never provider descriptions",async()=>{
 for(const code of ["KOE009","KOE010","KOE101","KOE114","KOE126","KOE127","KOE303","KOE320"]){
  const result=await finishSocialLogin(callback(),"kakao",env,async()=>"never",async()=>Response.json({error_code:code,error_description:"private-code-and-secret"},{status:401}),now);
  const html=await result.text();assert(html.includes("SOCIAL_KAKAO_"+code));assert(!html.includes("private-code-and-secret"));
  assert(readSocialResult({type:"paybridge-social-login",nonce,error:"SOCIAL_KAKAO_"+code},nonce));
 }
 const result=await finishSocialLogin(callback(),"kakao",env,async()=>"never",async()=>Response.json({error_code:"private-arbitrary-value",error_description:"private-secret"},{status:401}),now);
 const html=await result.text();assert(html.includes("SOCIAL_TOKEN_EXCHANGE_FAILED"));assert(!html.includes("private-arbitrary-value"));assert(!html.includes("private-secret"));
 assert.match(socialErrorMessage(Error("SOCIAL_KAKAO_KOE010")),/클라이언트 시크릿/);
});
test("provider credentials ignore accidental surrounding whitespace without altering token or code",async()=>{
 let received:URLSearchParams|undefined,calls=0;await exchangeSocialCode("kakao","fixture-code","fixture-state",{...env,KAKAO_REST_API_KEY:" kakao-test-id\n",KAKAO_CLIENT_SECRET:" kakao-test-secret\n"},async(_url,init)=>{if(++calls===1){received=new URLSearchParams(String(init?.body));return Response.json({access_token:"fixture-token"})}return Response.json({id:123})});
 assert.equal(received?.get("client_id"),"kakao-test-id");assert.equal(received?.get("client_secret"),"kakao-test-secret");assert.equal(received?.get("code"),"fixture-code");
});
