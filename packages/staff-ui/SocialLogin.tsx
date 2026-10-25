"use client";
import {useEffect, useRef, useState} from "react";
import {GoogleAuthProvider, linkWithPopup, signInWithCustomToken, signInWithPopup, type Auth} from "firebase/auth";
import {readSocialResult, socialErrorMessage} from "./social-policy";
type Props = {
  auth: Auth | null;
  apiOrigin: string;
  disabled?: boolean;
  blockCustomForGuest?: boolean;
  onBusyChange?: (busy: boolean) => void;
  allowLogin?: (provider: "google" | "kakao" | "naver") => boolean;
};
type Config = {google: boolean; kakao: boolean; naver: boolean};
const labels = {google: "구글", kakao: "카카오", naver: "네이버"};
export default function SocialLogin({auth, apiOrigin, disabled = false,
  blockCustomForGuest = false, onBusyChange, allowLogin}: Props) {
  const [config, setConfig] = useState<Config | null>(null);
  const [provider, setProvider] = useState<keyof Config | null>(null);
  const [error, setError] = useState("");
  const working = useRef(false), mounted = useRef(true);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => {if (mounted.current) setConfig({google:false,kakao:false,naver:false}); controller.abort();}, 10000);
    void fetch(apiOrigin.replace(/\/$/, "") + "/api/auth/social/config",
      {credentials: "omit", cache: "no-store", signal: controller.signal})
      .then(async r => {
        if (!r.ok) throw Error();
        const v = await r.json();
        if (["google", "kakao", "naver"].some(k => typeof v[k] !== "boolean")) throw Error();
        if (!controller.signal.aborted) setConfig(v);
      }).catch(() => {if (!controller.signal.aborted) setConfig({google: false, kakao: false, naver: false});}).finally(() => clearTimeout(timeout));
    return () => {mounted.current = false; clearTimeout(timeout); controller.abort(); cancel.current?.(); onBusyChange?.(false);};
  }, [apiOrigin]);
  function customLogin(p: "kakao" | "naver") {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const url = new URL("/api/auth/social/start", apiOrigin);
    url.search = new URLSearchParams({provider: p, origin: location.origin, nonce}).toString();
    const popup = window.open(url.href, "_blank", "popup,width=500,height=720");
    if (!popup) return Promise.reject(Error("POPUP_BLOCKED"));
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const finish = (token?: string, failure?: string) => {
        if (settled) return; settled = true;
        window.removeEventListener("message", receive);
        clearInterval(closed); clearTimeout(timeout);
        cancel.current = null;
        popup.close();
        failure ? reject(Error(failure)) : resolve(token!);
      };
      const receive = (event: MessageEvent) => {
        if (event.origin !== url.origin || event.source !== popup) return;
        const result = readSocialResult(event.data, nonce);
        if (!result) return;
        "token" in result ? finish(result.token) : finish(undefined, result.error);
      };
      window.addEventListener("message", receive);
      const closed = setInterval(() => {if (popup.closed) finish(undefined, "SOCIAL_CANCELLED");}, 500);
      const timeout = setTimeout(() => finish(undefined, "SOCIAL_TIMEOUT"), 5 * 60 * 1000);
      cancel.current = () => finish(undefined, "SOCIAL_CANCELLED");
    });
  }
  async function login(p: keyof Config) {
    if (!auth || disabled || working.current || !config?.[p] || (p !== "google" && blockCustomForGuest)) return;
    if (allowLogin && !allowLogin(p)) {setError("기존 비회원 주문 결과를 먼저 확인해 주세요. 주문 계정을 자동으로 바꾸지 않습니다."); return;}
    working.current = true; setProvider(p); setError(""); onBusyChange?.(true);
    try {
      if (p === "google") {
        const google = new GoogleAuthProvider();
        google.setCustomParameters({prompt: "select_account"});
        if (auth.currentUser?.isAnonymous) await linkWithPopup(auth.currentUser, google);
        else await signInWithPopup(auth, google);
      } else {
        const token = await customLogin(p);
        if (!mounted.current) return;
        await signInWithCustomToken(auth, token);
      }
    } catch (e) {
      if (mounted.current) setError(socialErrorMessage(e));
    } finally {
      working.current = false;
      if (mounted.current) {setProvider(null); onBusyChange?.(false);}
    }
  }
  return <div className="social-login" aria-label="간편로그인" aria-busy={!!provider}>
    <div className="social-login-buttons">
      {(Object.keys(labels) as (keyof Config)[]).map(p =>
        <button key={p} type="button" className={"social-button social-" + p}
          disabled={!auth || disabled || !!provider || !config?.[p] || (p !== "google" && blockCustomForGuest)}
          onClick={() => void login(p)}>
          <span>{labels[p]}로 계속하기</span>
          <small>{provider === p ? "로그인 확인 중…" : config === null ? "연결 확인 중…" :
            !config[p] ? "연결 준비 중" : p !== "google" && blockCustomForGuest ? "비회원 주문 확인 필요" : ""}</small>
        </button>)}
    </div>
    {blockCustomForGuest && <p className="social-help">비회원 주문은 먼저 결과를 확인해 주세요.
      구글 계정 연결은 현재 비회원 계정을 유지하지만, 이미 다른 계정에 연결된 경우 자동으로 합치지 않습니다.
      카카오·네이버로 기존 비회원 주문을 옮기는 기능은 지원하지 않습니다.</p>}
    {error && <p className="social-error" role="alert">{error}</p>}
    <p className="social-help">선택한 서비스의 로그인 창이 열립니다. 서비스별 연결 준비가 끝난 방법만 사용할 수 있습니다.</p>
  </div>;
}
