import {createHash, createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {z} from "zod";

const kakaoTokenCodes=["KOE009","KOE010","KOE101","KOE114","KOE126","KOE127","KOE303","KOE320"] as const;
class SocialFlowError extends Error {
  constructor(public code:string) {super(code)}
}
export type SocialEnv = Record<string, string | undefined>;
export type SocialProvider = "kakao" | "naver";
const providerSchema = z.enum(["kakao", "naver"]);
const nonceSchema = z.string().regex(/^[a-f0-9]{64}$/);
const stateSchema = z.object({
  provider: providerSchema, state: nonceSchema, nonce: nonceSchema,
  origin: z.string().url(), expires: z.number().int(),
}).strict();
type SocialState = z.infer<typeof stateSchema>;
const TTL = 600;
const defaults = ["https://paybridge-mock.web.app", "https://paybridge-mock.firebaseapp.com"];

function secureOrigin(value: string | undefined, env: SocialEnv) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.username || u.password || u.pathname !== "/" || u.search || u.hash) return null;
    if (u.protocol !== "https:" && !(env.NODE_ENV === "development" &&
      u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))) return null;
    return u.origin;
  } catch { return null; }
}
export function socialOrigins(env: SocialEnv) {
  return new Set([...defaults, apiOrigin(env), secureOrigin(env.ADMIN_SITE_ORIGIN, env),
    ...(env.NODE_ENV === "development" ? [secureOrigin(env.SOCIAL_CUSTOMER_DEV_ORIGIN, env)] : []),
  ].filter((s): s is string => !!s));
}
function apiOrigin(env: SocialEnv) {
  return secureOrigin(env.SOCIAL_AUTH_API_ORIGIN || "https://paybridge-mock.vercel.app", env);
}
function stateSecret(env: SocialEnv) {
  return env.SOCIAL_AUTH_STATE_SECRET && env.SOCIAL_AUTH_STATE_SECRET.length >= 32
    ? env.SOCIAL_AUTH_STATE_SECRET : null;
}
function credentials(provider: SocialProvider, env: SocialEnv) {
  return provider === "kakao"
    ? {id: env.KAKAO_REST_API_KEY?.trim(), secret: env.KAKAO_CLIENT_SECRET?.trim()}
    : {id: env.NAVER_CLIENT_ID?.trim(), secret: env.NAVER_CLIENT_SECRET?.trim()};
}
export function socialConfiguration(env: SocialEnv) {
  const base = !!(stateSecret(env) && apiOrigin(env) && env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
  return {
    google: env.SOCIAL_GOOGLE_ENABLED === "true",
    kakao: base && !!(env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET),
    naver: base && !!(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET),
  };
}
function baseHeaders() {
  return {"Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY"};
}
export function socialConfigResponse(request: Request, env: SocialEnv) {
  // Browsers omit Origin on same-origin GETs from the merchant site.
  // Only the configured canonical server may use this path; cross-site/no-metadata requests still fail closed.
  const origin = request.headers.get("origin") ||
    (request.headers.get("sec-fetch-site") === "same-origin" && new URL(request.url).origin === apiOrigin(env)
      ? new URL(request.url).origin : null);
  if (!origin || !socialOrigins(env).has(origin)) {
    return Response.json({error: "ORIGIN_NOT_ALLOWED"}, {status: 403, headers: baseHeaders()});
  }
  return Response.json(socialConfiguration(env), {headers: {
    ...baseHeaders(), "Access-Control-Allow-Origin": origin, Vary: "Origin, Sec-Fetch-Site",
  }});
}
function cookieName(provider: SocialProvider, env: SocialEnv) {
  return (apiOrigin(env)?.startsWith("https:") ? "__Host-" : "") + "paybridge-social-" + provider;
}
function cookie(provider: SocialProvider, value: string, env: SocialEnv, maxAge = TTL) {
  return cookieName(provider, env) + "=" + value + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
    maxAge + (apiOrigin(env)?.startsWith("https:") ? "; Secure" : "");
}
export function signSocialState(state: SocialState, secret: string) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
}
export function verifySocialState(value: string, secret: string, now = Date.now()): SocialState | null {
  if (value.length > 2048) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = stateSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.expires <= now || parsed.data.expires > now + TTL * 1000) return null;
    return parsed.data;
  } catch { return null; }
}
function one(url: URL, key: string) {
  return url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) : null;
}
function failure(status = 400) {
  return new Response("로그인을 완료하지 못했습니다. 이 창을 닫고 원래 화면에서 다시 시도해 주세요.",
    {status, headers: {...baseHeaders(), "Content-Type": "text/plain; charset=utf-8"}});
}
export function beginSocialLogin(request: Request, env: SocialEnv, now = Date.now()) {
  const url = new URL(request.url), provider = providerSchema.safeParse(one(url, "provider"));
  const origin = one(url, "origin"), nonce = nonceSchema.safeParse(one(url, "nonce"));
  if (!provider.success || !origin || !socialOrigins(env).has(origin) || !nonce.success ||
    url.origin !== apiOrigin(env)) return failure();
  const p = provider.data, secret = stateSecret(env);
  if (!secret || !socialConfiguration(env)[p]) return failure(503);
  const state: SocialState = {provider: p, origin, nonce: nonce.data,
    state: randomBytes(32).toString("hex"), expires: now + TTL * 1000};
  const target = new URL(p === "kakao"
    ? "https://kauth.kakao.com/oauth/authorize" : "https://nid.naver.com/oauth2.0/authorize");
  target.search = new URLSearchParams({
    response_type: "code", client_id: credentials(p, env).id!,
    redirect_uri: apiOrigin(env) + "/api/auth/social/callback/" + p, state: state.state,
  }).toString();
  return new Response(null, {status: 303, headers: {...baseHeaders(),
    Location: target.href, "Set-Cookie": cookie(p, signSocialState(state, secret), env)}});
}
export function socialUid(provider: SocialProvider, appId: string, subject: string) {
  // No email matching or caller-supplied Firebase UID. Different apps/providers stay separate.
  return "social:" + provider + ":" + createHash("sha256")
    .update(JSON.stringify([appId, subject])).digest("hex");
}
export async function exchangeSocialCode(provider: SocialProvider, code: string, state: string,
  env: SocialEnv, fetcher: typeof fetch = fetch) {
  const cfg = credentials(provider, env);
  if (!cfg.id || !cfg.secret || !apiOrigin(env)) throw Error("SOCIAL_CONFIG_MISSING");
  const body = new URLSearchParams({grant_type: "authorization_code", client_id: cfg.id,
    client_secret: cfg.secret, code, redirect_uri: apiOrigin(env) + "/api/auth/social/callback/" + provider,
    ...(provider === "naver" ? {state} : {})});
  const response = await fetcher(provider === "kakao"
    ? "https://kauth.kakao.com/oauth/token" : "https://nid.naver.com/oauth2.0/token",
    {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000)});
  if (!response.ok) {
    const body:unknown=await response.json().catch(()=>null);
    const code=body&&typeof body==="object"&&"error_code" in body?(body as {error_code:unknown}).error_code:null;
    // Report only documented public codes. Provider descriptions may contain credentials or auth codes.
    if(provider==="kakao"&&typeof code==="string"&&(kakaoTokenCodes as readonly string[]).includes(code))throw new SocialFlowError("SOCIAL_KAKAO_"+code);
    throw new SocialFlowError("SOCIAL_TOKEN_EXCHANGE_FAILED");
  }
  const token = z.object({access_token: z.string().min(1).max(8192)}).safeParse(await response.json());
  if (!token.success) throw new SocialFlowError("SOCIAL_TOKEN_EXCHANGE_FAILED");
  const profileResponse = await fetcher(provider === "kakao"
    ? "https://kapi.kakao.com/v2/user/me" : "https://openapi.naver.com/v1/nid/me",
    {headers: {Authorization: "Bearer " + token.data.access_token},
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000)});
  if (!profileResponse.ok) throw new SocialFlowError("SOCIAL_PROFILE_FAILED");
  const profile = await profileResponse.json();
  const kakao = z.object({id: z.number().int().positive().safe()}).safeParse(profile);
  const naver = z.object({resultcode: z.literal("00"),
    response: z.object({id: z.string().min(1).max(256)})}).safeParse(profile);
  const subject = provider === "kakao" ? (kakao.success ? String(kakao.data.id) : null)
    : (naver.success ? naver.data.response.id : null);
  if (!subject) throw new SocialFlowError("SOCIAL_PROFILE_FAILED");
  return socialUid(provider, cfg.id, subject);
}
function popupResponse(state: SocialState, result: {token: string} | {error: string}, env: SocialEnv) {
  const scriptNonce = randomBytes(18).toString("base64");
  const data = JSON.stringify({type: "paybridge-social-login", nonce: state.nonce, ...result})
    .replace(/</g, "\\u003c");
  const target = JSON.stringify(state.origin);
  const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>페이브릿지 로그인</title><body><h1>로그인 결과 확인</h1>' +
    '<p id="result">원래 페이지로 로그인 결과를 전달하고 있습니다.</p><script nonce="' + scriptNonce + '">' +
    'history.replaceState(null,"",location.pathname);' +
    'if(window.opener){window.opener.postMessage(' + data + ',' + target + ');window.close();}' +
    'else{document.getElementById("result").textContent="원래 페이지와 연결이 끊겼습니다. 이 창을 닫고 다시 시도해 주세요.";}' +
    '</script></body></html>';
  return new Response(html, {headers: {...baseHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": cookie(state.provider, "", env, 0),
    "Cross-Origin-Opener-Policy": "unsafe-none",
    "Content-Security-Policy": "default-src 'none'; script-src 'nonce-" + scriptNonce +
      "'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
export async function finishSocialLogin(request: Request, providerValue: string, env: SocialEnv,
  mint: (uid: string, claims: {social_provider: SocialProvider}) => Promise<string>,
  fetcher: typeof fetch = fetch, now = Date.now()) {
  const provider = providerSchema.safeParse(providerValue), secret = stateSecret(env);
  if (!provider.success || !secret) return failure();
  const p = provider.data, url = new URL(request.url);
  const cookies = (request.headers.get("cookie") || "").split(";").map(s => s.trim())
    .filter(s => s.startsWith(cookieName(p, env) + "="));
  const signed = cookies.length === 1 ? cookies[0].slice(cookieName(p, env).length + 1) : "";
  const state = verifySocialState(signed, secret, now);
  if (!state || state.provider !== p || !socialOrigins(env).has(state.origin) ||
    url.origin !== apiOrigin(env) || one(url, "state") !== state.state) {
    const response = failure();
    response.headers.set("Set-Cookie", cookie(p, "", env, 0));
    return response;
  }
  const code = one(url, "code");
  if (url.searchParams.has("error")) {
    return popupResponse(state, {error: one(url,"error")==="access_denied" ? "SOCIAL_CANCELLED" : "SOCIAL_PROVIDER_CONFIG_ERROR"}, env);
  }
  if (!code || code.length > 4096) return popupResponse(state,{error:"SOCIAL_LOGIN_FAILED"},env);
  if (!socialConfiguration(env)[p]) return popupResponse(state, {error: "SOCIAL_NOT_CONFIGURED"}, env);
  let uid: string;
  try { uid = await exchangeSocialCode(p, code, state.state, env, fetcher); }
  catch (error) {
    // Only a fixed stage code leaves the server; never provider bodies or credentials.
    return popupResponse(state, {error: error instanceof SocialFlowError ? error.code : "SOCIAL_LOGIN_FAILED"}, env);
  }
  try {
    // Claims identify the provider only; staff access still requires an existing DB membership.
    const token = await mint(uid, {social_provider:p});
    return popupResponse(state,{token},env);
  } catch {
    return popupResponse(state,{error:"SOCIAL_FIREBASE_TOKEN_FAILED"},env);
  }
}
