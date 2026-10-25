export type SocialResult = {type: "paybridge-social-login"; nonce: string} &
  ({token: string} | {error: string});
export function readSocialResult(value: unknown, nonce: string): SocialResult | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.type !== "paybridge-social-login" || v.nonce !== nonce) return null;
  if (Object.keys(v).some(k => !["type", "nonce", "token", "error"].includes(k))) return null;
  if (typeof v.token === "string" && v.error === undefined && v.token.length <= 8192 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.token)) return v as SocialResult;
  if (v.token === undefined && typeof v.error === "string" &&
    ["SOCIAL_CANCELLED", "SOCIAL_NOT_CONFIGURED", "SOCIAL_LOGIN_FAILED"].includes(v.error)) return v as SocialResult;
  return null;
}
export function socialErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : error instanceof Error ? error.message : "";
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request", "SOCIAL_CANCELLED"].includes(code))
    return "로그인을 취소했습니다. 원할 때 다시 시도해 주세요.";
  if (code === "auth/popup-blocked" || code === "POPUP_BLOCKED")
    return "로그인 창이 차단됐습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.";
  if (["auth/account-exists-with-different-credential", "auth/credential-already-in-use",
    "auth/email-already-in-use"].includes(code))
    return "이미 다른 방법으로 연결된 계정입니다. 기존 로그인 방법을 이용해 주세요. 계정을 자동으로 합치지 않습니다.";
  if (["auth/operation-not-allowed", "auth/unauthorized-domain", "SOCIAL_NOT_CONFIGURED"].includes(code))
    return "이 로그인 방법은 연결 준비 중입니다. 다른 로그인 방법을 이용해 주세요.";
  if (code === "auth/user-disabled") return "사용이 중지된 계정입니다. 관리자에게 문의해 주세요.";
  if (code === "SOCIAL_TIMEOUT") return "로그인 시간이 지났습니다. 다시 시도해 주세요.";
  return "간편로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
