"use client";
import { useEffect, useRef, useState } from "react";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import SocialLogin from "./SocialLogin";
import StaffAccess from "./StaffAccess";
import {PrivateInput,PrivateValue} from "./PrivateFields";
import "./social-login.css";
import "./workspace.css";
import { unseenOrderIds } from "./new-orders";
type Package = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  version: number;
  spaceName: string;
};
type Dashboard = {
  merchantId: string;
  totals: { count: number; revenue: number; average: number };
  payments: {
    payment_id: string;
    order_id: string;
    product_name: string;
    quantity: number;
    amount: number;
    created_at: string;
    status: string;
    items?: {
      productId: string;
      productName: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
    }[];
  }[];
  asOf: string;
  packages?: Package[];
  roles?: { role: string; count: number }[];
  audit?: {
    id: number;
    product_id: string;
    old_active: number;
    new_active: number;
    created_at: string;
  }[];
};
const money = (n: number) => new Intl.NumberFormat("ko-KR").format(Number(n));
const date = (s: string) =>
  new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z").toLocaleString(
    "ko-KR",
    { timeZone: "Asia/Seoul" },
  );
type Props = {
  admin?: boolean;
  firebaseConfig: FirebaseOptions;
  apiOrigin?: string;
  adminSiteUrl?: string;
  merchantSiteUrl?: string;
};
export default function StaffDashboard({
  admin = false,
  firebaseConfig,
  apiOrigin = "",
  adminSiteUrl,
  merchantSiteUrl = "https://paybridge-mock.vercel.app/",
}: Props) {
  const configured = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.appId,
  ].every(Boolean);
  const clientAuth = () =>
    getAuth(getApps()[0] || initializeApp(firebaseConfig));
  const api = (path: string) => apiOrigin.replace(/\/$/, "") + path;
  const [user, setUser] = useState<User | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0);
  const [view, setView] = useState(admin ? "packages" : "overview");
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const views = admin ? ["packages", "accounts", "transactions", "activity"] : ["overview", "transactions", "accounts"];
  useEffect(() => {
    const sync = () => { const hash = window.location.hash.slice(1); if (views.includes(hash)) setView(hash); };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [admin]);
  function navigate(next: string) { if (accessBusy) return; setView(next); window.history.replaceState(null, "", "#" + next); requestAnimationFrame(() => { viewHeading.current?.focus({preventScroll:true}); window.scrollTo({top:0}); }); }
  const [socialBusy, setSocialBusy] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [packageFilter, setPackageFilter] = useState("all"),
    [pendingPackage, setPendingPackage] = useState<string | null>(null);
  const focusedPackage = useRef<string | null>(null);
  useEffect(() => {
    if (focusedPackage.current && document.activeElement === document.body)
      (
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(".package-action"),
        ).find(
          (button) =>
            button.getAttribute("data-package") === focusedPackage.current,
        ) ||
        (document.querySelector(
          '.package-filters button[aria-pressed="true"]',
        ) as HTMLButtonElement | null)
      )?.focus();
    focusedPackage.current = null;
  }, [data]);
  const auditSeen = useRef<Set<number> | null>(null);
  const [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState<{ ids: string[]; message: string } | null>(
      null,
    );
  const seen = useRef<Set<string> | null>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    seen.current = null;
    auditSeen.current = null;
    setNotice(null);
    setActionError("");
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [user?.uid, admin]);
  const current = useRef<string | null>(null),
    inFlight = useRef(false),
    saving = useRef(false);
  useEffect(() => {
    if (configured)
      return onAuthStateChanged(clientAuth(), (u) => {
        current.current = u?.uid || null;
        setUser(u);
        setData(null);
        setError("");
      });
  }, []);
  useEffect(() => {
    if (!user) return;
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const uid = user.uid;
    async function refresh() {
      if (disposed) return;
      if (
        inFlight.current ||
        saving.current ||
        document.visibilityState === "hidden"
      ) {
        timer = setTimeout(refresh, 1000);
        return;
      }
      inFlight.current = true;
      try {
        const response = await fetch(
          api(admin ? "/api/admin/overview" : "/api/payments"),
          {
            headers: { Authorization: "Bearer " + (await user!.getIdToken()) },
            cache: "no-store",
            signal: controller.signal,
            credentials: "omit",
          },
        );
        if (disposed || current.current !== uid) return;
        if (response.status === 401 || response.status === 403) {
          seen.current = null;
          auditSeen.current = null;
          setNotice(null);
          setData(null);
          setError(
            admin
              ? "관리자 권한이 없습니다. 승인된 계정으로 로그인해 주세요."
              : "판매자 권한이 없습니다. 승인된 계정으로 로그인해 주세요.",
          );
          return;
        }
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!disposed && current.current === uid) {
          const ids = result.payments.map(
            (p: Dashboard["payments"][number]) => p.payment_id,
          );
          const fresh = unseenOrderIds(seen.current, ids);
          seen.current = new Set([...(seen.current || []), ...ids]);
          if (fresh.length && !admin) {
            setNotice({
              ids: fresh,
              message: `새 모의 주문 ${fresh.length}건이 확인되었습니다.`,
            });
            if (noticeTimer.current) clearTimeout(noticeTimer.current);
            noticeTimer.current = setTimeout(() => setNotice(null), 8000);
          }
          if (admin) {
            const auditIds = (result.audit || []).map(
              (a: NonNullable<Dashboard["audit"]>[number]) => a.id,
            );
            const changes =
              auditSeen.current === null
                ? []
                : auditIds.filter((id: number) => !auditSeen.current!.has(id));
            auditSeen.current = new Set([
              ...(auditSeen.current || []),
              ...auditIds,
            ]);
            if (changes.length) {
              setNotice({
                ids: changes.map(String),
                message: `패키지 공개 상태 변경 ${changes.length}건이 확인되었습니다.`,
              });
              if (noticeTimer.current) clearTimeout(noticeTimer.current);
              noticeTimer.current = setTimeout(() => setNotice(null), 8000);
            }
          }
          focusedPackage.current ||=
            document.activeElement?.getAttribute("data-package") || null;
          setData(result);
          setError("");
        }
      } catch (e) {
        if (!disposed && current.current === uid) {
          setError(
            "연결이 지연되고 있습니다. 이전에 확인한 값은 유지하며 자동으로 다시 확인합니다.",
          );
        }
      } finally {
        inFlight.current = false;
      }
      if (!disposed) timer = setTimeout(refresh, admin ? 30000 : 5000);
    }
    void refresh();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [user, admin, revision, apiOrigin]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (socialBusy || busy || !configured) return;
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(clientAuth(), email, password);
      setPassword("");
    } catch {
      setError("이메일과 비밀번호를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    current.current = null;
    setData(null);
    setError("");
    await signOut(clientAuth());
  }
  async function toggle(p: Package) {
    if (!user || saving.current) return;
    const uid = user.uid;
    focusedPackage.current =
      document.activeElement?.getAttribute("data-package") || null;
    saving.current = true;
    setBusy(true);
    setPendingPackage(p.id);
    setActionError("");
    try {
      const response = await fetch(api("/api/admin/packages"), {
        method: "POST",
        credentials: "omit",
        headers: {
          Authorization: "Bearer " + (await user.getIdToken()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: p.id,
          active: !p.active,
          version: p.version,
        }),
      });
      if (current.current !== uid) return;
      if (response.status === 409)
        throw Error(
          "다른 변경이 먼저 반영되었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.",
        );
      if (!response.ok)
        throw Error(
          "변경 결과를 확인하지 못했습니다. 최신 상태를 확인해 주세요.",
        );
      setActionError("");
    } catch (e) {
      if (current.current === uid)
        setActionError(e instanceof Error ? e.message : "변경 실패");
    } finally {
      saving.current = false;
      setBusy(false);
      setPendingPackage(null);
      setRevision((v) => v + 1);
    }
  }
  const visiblePackages = (data?.packages || []).filter(
    (p) =>
      packageFilter === "all" ||
      (packageFilter === "active" ? p.active : !p.active),
  );
  const title = admin ? "관리자" : "판매자 센터";
  const payments = (data?.payments || []).filter((p) =>
    `${p.product_name} ${(p.items || []).map((i) => i.productName).join(" ")} ${p.payment_id} ${p.order_id}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const shownPayments = view === "overview" ? (data?.payments || []).slice(0,5) : payments;
  if (!user) return <div className={"auth-page " + (admin ? "theme-admin" : "theme-merchant")}>
    <a className="auth-brand" href="/">paybridge<span>{admin ? "관리자" : "판매자 센터"}</span></a>
    <main className="auth-layout"><section className="auth-story">
      <p className="eyebrow">{admin ? "A CLEARER WAY TO MANAGE" : "YOUR STORE, AT A GLANCE"}</p>
      <h1>{admin ? <>운영의 모든 기준을,<br/>한곳에서.</> : <>좋은 공간의 시작,<br/>매일의 주문에서.</>}</h1>
      <p>{admin ? "공간과 패키지, 계정과 권한을 구분해 관리합니다." : "공간 패키지의 주문과 매출을 한눈에 확인합니다."}</p>
      <WorkspaceArt admin={admin}/><div className="auth-story-caption"><span>01 / {admin ? "CONTROL ROOM" : "SMART LIVING STORE"}</span><span>PAYBRIDGE</span></div>
    </section><div className="auth-form-wrap"><section className="login card">
              <p className="eyebrow">{admin ? "ADMINISTRATOR" : "MERCHANT WORKSPACE"}</p>
              <h2>{title} 로그인</h2>
              <p className="login-lead">{admin ? "승인된 계정으로 운영 공간에 접속하세요." : "오늘의 주문과 매출을 확인하세요."}</p>
              <SocialLogin auth={configured ? clientAuth() : null} apiOrigin={apiOrigin || "https://paybridge-mock.vercel.app"}
                disabled={busy} onBusyChange={setSocialBusy}/>
                <p className="social-divider">또는 이메일로 로그인</p>

              <form onSubmit={login}>
                <label>
                  이메일
                  <input
                    type="email"
                    autoComplete="username"
                    disabled={busy || socialBusy}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                  <PrivateInput label="비밀번호" visibilityLabel="로그인 비밀번호"
                    autoComplete="current-password"
                    disabled={busy || socialBusy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                <button className="primary" disabled={!configured || busy || socialBusy}>
                  {busy ? "확인 중…" : "로그인"}
                </button>
              </form>
            </section>
      {!configured && <p className="notice">로그인 연결 설정을 확인 중입니다.</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      <p className="auth-note">승인된 계정만 이용할 수 있습니다. 실제 청구 없는 모의 서비스입니다.</p>
      <a className="auth-back" href="https://paybridge-mock.web.app/">고객 스토어 둘러보기 <span aria-hidden="true">↗</span></a>
    </div></main></div>;
  return (
    <div className={"shell " + (admin ? "theme-admin" : "theme-merchant")}>
      <aside>
        <a className="brand" href="/">
          paybridge<span>{title}</span>
        </a>
        <div className="store">
          <div className="avatar">S</div>
          <div>
            <b>SMART HOME</b>
            <small>한 브랜드 · 모의 스토어</small>
          </div>
        </div>
        <nav aria-label={admin ? "관리자 메뉴" : "판매자 메뉴"}>
          {(admin ? [["packages","공간·패키지"],["accounts","계정·권한"],["transactions","주문 현황"],["activity","변경 이력"]] : [["overview","매출 개요"],["transactions","주문 내역"],["accounts","내 계정"]]).map(([key,label],i)=><a key={key} href={"#"+key} className={view===key?"active":undefined} aria-current={view===key?"page":undefined} onClick={e=>{e.preventDefault();navigate(key)}} aria-disabled={accessBusy}><span className="nav-number" aria-hidden="true">0{i+1}</span>{label}</a>)}
          <div className="nav-external-label">다른 공간</div>
          {(admin || adminSiteUrl) && <a href={admin ? merchantSiteUrl : adminSiteUrl}>{admin ? "판매자 센터" : "관리자 사이트"}<span aria-hidden="true">↗</span></a>}
          <a href="https://paybridge-mock.web.app/">고객 스토어<span aria-hidden="true">↗</span></a>
        </nav>
        <div className="sidebar-bottom">
          모의 주문 환경<p>실제 결제·배송·기기 연결 없음</p>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            SMART HOME / <b>{title}</b>
          </span>
          <span className="badge">{admin ? "운영 관리" : "판매자 전용"} · 모의 서비스</span>
        </header>
        <main id="overview">
          <div className="heading">
            <div>
              <span className="eyebrow">
                {admin ? "SPACE & PACKAGE MANAGEMENT" : "YOUR SMART HOME STORE"}
              </span>
              <h1 ref={viewHeading} tabIndex={-1}>{view==="accounts" ? (admin ? "계정과 권한" : "내 계정") : view==="transactions" ? "주문 내역" : view==="activity" ? "변경 이력" : admin ? "공간과 패키지" : "스토어 한눈에"}</h1>
              <p>
                {view==="accounts" ? "로그인 계정과 이용 권한을 확인하세요." : view==="activity" ? "패키지의 공개 상태가 바뀐 기록입니다." : view==="transactions" ? "주문 구성과 금액을 확인하고 검색하세요." : admin ? "고객에게 공개할 공간과 패키지를 관리하세요." : "공간 패키지의 주문과 매출을 확인하세요."}
              </p>
            </div>
            {user && (
              <div className="actions">
                <button disabled={busy || accessBusy} onClick={() => void logout()}>로그아웃</button>
              </div>
            )}
          </div>
          {!configured && (
            <p className="notice">로그인 연결 설정을 확인 중입니다.</p>
          )}

            <>
              <div hidden={view!=="accounts"} className="staff-account-id">내 계정 고유번호(UID)
                <PrivateValue key={user.uid} value={user.uid} label="내 계정 고유번호"/>
              </div>
              <div hidden={view!=="accounts"}>{admin ? <StaffAccess auth={clientAuth()} user={user} apiOrigin={apiOrigin}
                disabled={busy} onBusyChange={setAccessBusy} onChanged={()=>setRevision(v=>v+1)}/> : <section className="card account-help"><h2>판매자 이용 권한</h2><p>권한이 필요하면 위 계정 고유번호를 확인해 마스터에게 전달하세요.</p><p>이메일과 고유번호는 눈 버튼으로 확인할 수 있습니다.</p></section>}</div>
              <div className="status-line" hidden={view==="accounts"}>
                <span>
                  {data ? "마지막으로 확인한 모의 거래" : "권한·DB 확인 중"}
                </span>
                <small>
                  {data
                    ? `${date(data.asOf)} 기준 · 자동 갱신`
                    : "로그인만으로 관리 권한이 부여되지 않습니다."}
                </small>
              </div>
              {notice && (
                <div
                  key={`notice:${notice.ids.join(",")}`}
                  className="new-order-notice"
                  role="status"
                  aria-live="polite"
                >
                  <span>{notice.message}</span>
                  <button
                    onClick={() => setNotice(null)}
                    aria-label="새 주문 안내 닫기"
                  >
                    닫기
                  </button>
                </div>
              )}
              {admin && data && (
                <section
                  hidden={view!=="packages"}
                  className="package-section"
                  aria-labelledby="package-heading"
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">SPACE COLLECTION</span>
                      <h2 id="package-heading">공간·패키지</h2>
                      <p>공간별 공개 상태를 확인하고 관리하세요.</p>
                    </div>
                    <span className="collection-count">
                      공개 {data.packages?.filter((p) => p.active).length || 0}{" "}
                      / 전체 {data.packages?.length || 0}
                    </span>
                  </div>
                  <div
                    className="package-filters"
                    role="group"
                    aria-label="패키지 공개 상태 필터"
                  >
                    {[
                      ["all", "전체"],
                      ["active", "스토어 공개"],
                      ["paused", "구매 중지"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={packageFilter === value}
                        onClick={() => setPackageFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {actionError && (
                    <div role="alert" className="notice">
                      {actionError}
                      <button
                        onClick={() => setActionError("")}
                        aria-label="변경 오류 안내 닫기"
                      >
                        닫기
                      </button>
                    </div>
                  )}
                  <div className="package-grid">
                    {visiblePackages.map((p) => (
                      <article
                        key={p.id}
                        className="card package-card"
                        aria-busy={pendingPackage === p.id}
                      >
                        <SpacePreview id={p.id} />
                        <div className="package-body">
                          <div className="package-meta">
                            <span>{p.spaceName}</span>
                            <span
                              className={
                                p.active
                                  ? "package-state is-public"
                                  : "package-state"
                              }
                            >
                              {p.active ? "스토어 공개" : "구매 중지"}
                            </span>
                          </div>
                          <h3>{p.name}</h3>
                          <p className="package-price">
                            {money(p.price)}
                            <small>원 · 예시 가격</small>
                          </p>
                          <button
                            className="package-action"
                            data-package={p.id}
                            aria-label={`${p.name} ${p.active ? "구매 중지하기" : "스토어에 공개하기"}`}
                            disabled={busy}
                            onClick={() => void toggle(p)}
                          >
                            {pendingPackage === p.id
                              ? "변경 결과 확인 중…"
                              : p.active
                                ? "구매 중지하기"
                                : "스토어에 공개하기"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!visiblePackages.length && (
                    <p className="empty card">
                      선택한 상태의 패키지가 없습니다.
                    </p>
                  )}
                  <div className="role-summary">
                    <div>
                      <b>접근 역할</b>
                      <span>
                        {data.roles
                          ?.map(
                            (r) =>
                              `${r.role === "admin" ? "관리자" : "판매자"} ${r.count}명`,
                          )
                          .join(" · ")}
                      </span>
                    </div>
                    <p>
                      승인된 계정의 역할을 표시합니다. 계정과 권한은 별도
                      관리합니다.
                    </p>
                  </div>
                </section>
              )}
              <div hidden={view!=="overview" && view!=="transactions"}><div hidden={view!=="overview"}><div className="dashboard-summary">
                <div>
                  <span className="eyebrow">STORE OVERVIEW</span>
                  <h2>모의 거래 현황</h2>
                </div>
                <span>전체 기간 누적 기준</span>
              </div>
              <section
                key={
                  !admin && notice
                    ? `metrics:${notice.ids.join(",")}`
                    : "metrics:quiet"
                }
                className={
                  !admin && notice ? "metrics metrics-updated" : "metrics"
                }
              >
                <article className="card">
                  <span>누적 모의 매출</span>
                  <h2>
                    {data ? money(data.totals.revenue) : "—"}
                    <small> 원</small>
                  </h2>
                  <p>실제 정산 금액이 아닙니다.</p>
                </article>
                <article className="card">
                  <span>모의 주문 건수</span>
                  <h2>
                    {data ? money(data.totals.count) : "—"}
                    <small> 건</small>
                  </h2>
                  <p>같은 주문 요청은 한 번 집계</p>
                </article>
                <article className="card">
                  <span>평균 모의 결제</span>
                  <h2>
                    {data ? money(data.totals.average) : "—"}
                    <small> 원</small>
                  </h2>
                  <p>DB에 확정된 모의 승인 기준</p>
                </article>
              </section>
              </div><section id="transactions" className="card transactions">
                <div className="card-heading">
                  <div>
                    <h2>{view==="overview" ? "최근 주문" : "모의 주문·결제 내역"}</h2>
                    <p>
                      {view==="overview" ? "가장 최근에 확인한 모의 주문 5건" : "최근 100건 안에서 검색할 수 있습니다."}
                    </p>
                  </div>
                  {view==="overview" && <button type="button" onClick={()=>navigate("transactions")}>전체 주문 보기</button>}
                  <input hidden={view!=="transactions"}
                    aria-label="주문 검색"
                    placeholder="패키지명·주문/결제 번호"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>패키지 / 주문·결제 번호</th>
                        <th>시각</th>
                        <th>수량</th>
                        <th>모의 금액</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownPayments.map((p) => (
                        <tr
                          key={p.payment_id}
                          className={
                            !admin && notice?.ids.includes(p.payment_id)
                              ? "new-order-row"
                              : undefined
                          }
                        >
                          <td>
                            <b>{p.product_name}</b>
                            {!!p.items?.length && (
                              <ul
                                className="order-items"
                                aria-label="주문 구성"
                              >
                                {[...p.items]
                                  .sort((a, b) =>
                                    a.productId.localeCompare(b.productId),
                                  )
                                  .map((i) => (
                                    <li key={i.productId}>
                                      {i.productName} · {i.quantity}개 ·{" "}
                                      {money(i.lineTotal)}원
                                    </li>
                                  ))}
                              </ul>
                            )}
                            {!admin && notice?.ids.includes(p.payment_id) && (
                              <span className="new-order-label">새 주문</span>
                            )}
                            <small>{p.order_id}</small>
                            <small>{p.payment_id}</small>
                          </td>
                          <td>{date(p.created_at)}</td>
                          <td>{p.quantity}</td>
                          <td>{money(p.amount)}원</td>
                          <td>
                            <span className="approved">모의 승인</span>
                          </td>
                        </tr>
                      ))}
                      {shownPayments.length === 0 && (
                        <tr>
                          <td colSpan={5} className="empty">
                            {data
                              ? view==="transactions" && search
                                ? "검색 조건에 맞는 주문이 없습니다."
                                : "표시할 모의 주문이 없습니다."
                              : "데이터 확인 중입니다."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              </div>
              {admin && data && (
                <section hidden={view!=="activity"}
                  className="card audit-section"
                  aria-labelledby="audit-heading"
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ACTIVITY</span>
                      <h2 id="audit-heading">패키지 변경 이력</h2>
                    </div>
                    <span className="collection-count">
                      최근 {data.audit?.length || 0}건
                    </span>
                  </div>
                  {data.audit?.length ? (
                    <ol className="audit-list">
                      {data.audit.map((a) => (
                        <li
                          key={a.id}
                          className={
                            notice?.ids.includes(String(a.id))
                              ? "audit-updated"
                              : undefined
                          }
                        >
                          <span className="audit-dot" aria-hidden="true" />
                          <div>
                            <b>
                              {data.packages?.find((p) => p.id === a.product_id)
                                ?.name || a.product_id}
                            </b>
                            <p>
                              {a.old_active ? "스토어 공개" : "구매 중지"}
                              <span aria-hidden="true"> → </span>
                              <span className="sr-only">에서 </span>
                              {a.new_active ? "스토어 공개" : "구매 중지"}
                              <span className="sr-only">로 변경</span>
                            </p>
                          </div>
                          <time>{date(a.created_at)}</time>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="empty">아직 변경 이력이 없습니다.</p>
                  )}
                </section>
              )}
            </>

          {error && (
            <div role="alert" className="notice">
              <span>{error}</span> <button onClick={()=>navigate("accounts")}>계정·권한 확인</button>
            </div>
          )}
          <footer>PAYBRIDGE <span>모의 주문 환경 · 실제 청구와 정산 없음</span></footer>
        </main>
      </div>
    </div>
  );
}

function SpacePreview({ id }: { id: string }) {
  const bedroom = id.includes("bedroom"),
    kitchen = id.includes("kitchen");
  return (
    <div
      className={`package-preview ${bedroom ? "bedroom" : kitchen ? "kitchen" : "desk"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 156" fill="none">
        <path
          d="M0 126L160 82 320 126V156H0Z"
          fill="currentColor"
          opacity=".09"
        />
        <path
          d="M160 15V83M160 83L40 119M160 83L280 119"
          stroke="currentColor"
          opacity=".15"
        />
        {bedroom ? (
          <>
            <path d="M80 88L159 64 234 86 155 112Z" fill="#a7bba7" />
            <path d="M80 88V105L155 131 234 103V86L155 112Z" fill="#537767" />
            <path d="M84 87L106 80 177 102 155 110Z" fill="#f7f4e8" />
            <path d="M89 85L108 79 128 85 109 91Z" fill="#fff" />
            <path
              d="M221 56V88M205 56H237L229 33H213Z"
              stroke="#9b7a42"
              strokeWidth="3"
            />
            <ellipse
              className="preview-light"
              cx="221"
              cy="91"
              rx="38"
              ry="12"
              fill="#e7bc72"
              opacity=".22"
            />
          </>
        ) : kitchen ? (
          <>
            <path d="M75 73L168 47 251 74 158 102Z" fill="#f5f0de" />
            <path
              d="M75 73V104L158 131V102ZM158 102L251 74V104L158 131Z"
              fill="#709987"
            />
            <path
              d="M107 84V113M135 94V122M189 92V122M219 83V112"
              stroke="#d9e5d9"
            />
            <ellipse cx="167" cy="66" rx="22" ry="7" fill="#b4c5bd" />
            <path
              d="M167 67V52Q167 45 177 49"
              stroke="#557567"
              strokeWidth="3"
            />
            <circle
              className="preview-light"
              cx="230"
              cy="44"
              r="8"
              fill="#dcbb76"
            />
          </>
        ) : (
          <>
            <path d="M70 78L161 52 251 80 159 108Z" fill="#c3a67e" />
            <path
              d="M80 84V118M159 107V140M241 85V120"
              stroke="#587464"
              strokeWidth="5"
            />
            <path d="M137 47L189 61V88L137 73Z" fill="#496d60" />
            <path d="M143 54L182 65V79L143 68Z" fill="#d0dfca" />
            <path d="M203 71V53L217 38" stroke="#7d835c" strokeWidth="3" />
            <path d="M208 36L228 42 221 49 204 43Z" fill="#dbbd80" />
            <ellipse
              className="preview-light"
              cx="213"
              cy="80"
              rx="28"
              ry="9"
              fill="#ffe3a5"
              opacity=".4"
            />
          </>
        )}
      </svg>
    </div>
  );
}

function WorkspaceArt({admin}:{admin:boolean}) { return <svg className="workspace-art" viewBox="0 0 600 330" fill="none" aria-hidden="true"><circle cx="300" cy="178" r="146" fill="currentColor" opacity=".05"/><path d="M70 237 298 110 532 238 302 322Z" fill="currentColor" opacity=".07"/><rect x="112" y="56" width="376" height="218" rx="16" fill="white" stroke="currentColor" strokeOpacity=".15"/><path d="M112 96h376" stroke="currentColor" strokeOpacity=".12"/><circle cx="136" cy="77" r="4" fill="currentColor" opacity=".5"/><circle cx="150" cy="77" r="4" fill="currentColor" opacity=".2"/><rect x="134" y="117" width="86" height="135" rx="8" fill="currentColor" opacity=".08"/><path d="M150 138h50m-50 19h36m-36 19h42" stroke="currentColor" strokeOpacity=".4" strokeWidth="5" strokeLinecap="round"/>{admin ? <><rect x="240" y="119" width="224" height="39" rx="7" fill="currentColor" opacity=".07"/><rect x="240" y="168" width="224" height="36" rx="7" fill="currentColor" opacity=".05"/><rect x="240" y="214" width="224" height="36" rx="7" fill="currentColor" opacity=".07"/>{[138,186,232].map(y=><g key={y}><circle cx="259" cy={y} r="7" fill="currentColor" opacity=".4"/><path d={`M278 ${y}h80`} stroke="currentColor" strokeWidth="5" opacity=".25" strokeLinecap="round"/><path d={`m430 ${y} 4 4 8-9`} stroke="currentColor" strokeWidth="3"/></g>)}</> : <><rect x="240" y="119" width="103" height="47" rx="7" fill="currentColor" opacity=".08"/><rect x="355" y="119" width="109" height="47" rx="7" fill="currentColor" opacity=".05"/><path d="M246 239v-32m32 32v-46m32 46v-37m32 37v-63m32 63v-52m32 52v-77m32 77v-93" stroke="currentColor" strokeWidth="15" opacity=".45"/><path d="M242 243h222" stroke="currentColor" strokeOpacity=".2"/></>}<rect x="420" y="244" width="115" height="49" rx="12" fill="currentColor"/><path d="m438 267 6 6 12-15" stroke="white" strokeWidth="3"/><path d="M469 265h45m-45 10h28" stroke="white" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round"/></svg>; }
