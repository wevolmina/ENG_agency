export const socialResultErrors = ["SOCIAL_CANCELLED", "SOCIAL_NOT_CONFIGURED", "SOCIAL_LOGIN_FAILED",
  "SOCIAL_TOKEN_EXCHANGE_FAILED", "SOCIAL_PROFILE_FAILED", "SOCIAL_FIREBASE_TOKEN_FAILED", "SOCIAL_PROVIDER_CONFIG_ERROR"] as const;
const clientErrors = ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/popup-blocked", "POPUP_BLOCKED",
  "auth/account-exists-with-different-credential", "auth/credential-already-in-use", "auth/email-already-in-use",
  "auth/operation-not-allowed", "auth/unauthorized-domain", "auth/invalid-api-key", "auth/app-not-authorized",
  "auth/invalid-custom-token", "auth/custom-token-mismatch", "auth/network-request-failed", "auth/web-storage-unsupported",
  "auth/operation-not-supported-in-this-environment", "auth/user-disabled", "auth/internal-error", "SOCIAL_TIMEOUT"];
export type SocialResult = {type: "paybridge-social-login"; nonce: string} & ({token: string} | {error: string});
export function readSocialResult(value: unknown, nonce: string): SocialResult | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.type !== "paybridge-social-login" || v.nonce !== nonce) return null;
  if (Object.keys(v).some(k => !["type", "nonce", "token", "error"].includes(k))) return null;
  if (typeof v.token === "string" && v.error === undefined && v.token.length <= 8192 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.token)) return v as SocialResult;
  if (v.token === undefined && typeof v.error === "string" &&
    (socialResultErrors as readonly string[]).includes(v.error)) return v as SocialResult;
  return null;
}
// Only fixed, public error codes may be displayed. Never echo SDK/provider error payloads.
export function socialErrorCode(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : error instanceof Error ? error.message : "";
  return [...socialResultErrors, ...clientErrors].includes(code) ? code : "SOCIAL_LOGIN_FAILED";
}
export function socialErrorMessage(error: unknown) {
  const code = socialErrorCode(error);
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request", "SOCIAL_CANCELLED"].includes(code))
    return "로그인을 취소했습니다. 원할 때 다시 시도해 주세요.";
  if (code === "auth/popup-blocked" || code === "POPUP_BLOCKED")
    return "로그인 창이 차단됐습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.";
  if (["auth/account-exists-with-different-credential", "auth/credential-already-in-use", "auth/email-already-in-use"].includes(code))
    return "이미 다른 방법으로 연결된 계정입니다. 기존 로그인 방법을 이용해 주세요. 계정을 자동으로 합치지 않습니다.";
  if (code === "auth/unauthorized-domain") return "이 사이트 주소가 Firebase 로그인 허용 도메인에 등록되지 않았습니다. 사이트 운영자가 허용 도메인을 확인해야 합니다.";
  if (code === "auth/operation-not-allowed") return "Firebase에서 이 로그인 방법이 활성화되지 않았습니다. 사이트 운영자가 로그인 제공업체 설정을 확인해야 합니다.";
  if (["auth/invalid-api-key", "auth/app-not-authorized", "auth/custom-token-mismatch"].includes(code))
    return "사이트의 Firebase 연결 설정이 올바르지 않습니다. 세 사이트와 로그인 서버가 같은 프로젝트를 사용하는지 확인해야 합니다.";
  if (["SOCIAL_TOKEN_EXCHANGE_FAILED", "SOCIAL_PROVIDER_CONFIG_ERROR"].includes(code))
    return "로그인 제공업체가 연결 요청을 거절했습니다. 사이트 운영자가 앱 키·시크릿과 로그인 후 돌아올 주소를 확인해야 합니다.";
  if (code === "SOCIAL_PROFILE_FAILED") return "로그인 제공업체에서 계정 정보를 확인하지 못했습니다. 사이트 운영자가 계정 정보 조회 설정을 확인해야 합니다.";
  if (["SOCIAL_FIREBASE_TOKEN_FAILED", "auth/invalid-custom-token"].includes(code))
    return "로그인 결과를 Firebase 계정으로 연결하지 못했습니다. 사이트 운영자가 Firebase 서버 인증 설정을 확인해야 합니다.";
  if (code === "SOCIAL_NOT_CONFIGURED") return "이 로그인 방법의 서버 연결 설정이 완료되지 않았습니다. 사이트 운영자에게 문의해 주세요.";
  if (code === "auth/network-request-failed") return "로그인 서버에 연결하지 못했습니다. 네트워크와 브라우저 차단 설정을 확인한 뒤 다시 시도해 주세요.";
  if (["auth/web-storage-unsupported", "auth/operation-not-supported-in-this-environment"].includes(code))
    return "현재 브라우저에서 로그인 저장소를 사용할 수 없습니다. 일반 브라우저 창에서 저장소와 쿠키 차단 설정을 확인해 주세요.";
  if (code === "auth/user-disabled") return "사용이 중지된 계정입니다. 관리자에게 문의해 주세요.";
  if (code === "SOCIAL_TIMEOUT") return "로그인 시간이 지났습니다. 다시 시도해 주세요.";
  return "간편로그인을 완료하지 못했습니다. 아래 진단 코드를 사이트 운영자에게 전달해 주세요.";
}
