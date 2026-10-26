import {useEffect,useRef,useState} from "react";
import {onIdTokenChanged,signInAnonymously,signOut,type User} from "firebase/auth";
import SocialLogin from "@bridge/staff-ui/SocialLogin";
import "@bridge/staff-ui/social-login.css";
import {auth,configured} from "./firebase";
import {spacePackages,isSpaceProductId,type SpaceProductId} from "./space-packages";
import "./smartspace.css";
import "./cart.css";
import "./storefront.css";
const API_ORIGIN=(import.meta.env.VITE_STAFF_API_ORIGIN||"").replace(/\/$/,"");
const API=API_ORIGIN+"/api/",DRAFT="smartspace-cart:v1";
type Package={id:string;name:string;price:number;active:boolean;spaceName:string};
type Line={productId:string;productName:string;unitPrice:number;quantity:number;lineTotal:number};
type Receipt={productId:string;paymentId:string;orderId:string;productName:string;quantity:number;amount:number;status:string;createdAt:string;items?:Line[]};
type Pending={requestId:string;items:{productId:SpaceProductId;quantity:1}[]}|{requestId:string;productId:SpaceProductId;quantity:1};
const ids=Object.keys(spacePackages) as SpaceProductId[],money=(n:number)=>new Intl.NumberFormat("ko-KR").format(n)+"원";
function requestIds(request:Pending){return ("items" in request?request.items.map(i=>i.productId):[request.productId]).sort()}
function pendingRequest(raw:string):Pending{
 const value=JSON.parse(raw);if(typeof value.requestId!=="string"||!/^[a-f0-9-]{36}$/i.test(value.requestId))throw Error("PENDING_INVALID");
 if(Array.isArray(value.items)){if(Object.keys(value).some(k=>!["items","requestId"].includes(k))||value.items.length<1||value.items.length>3||value.items.some((i:{productId:unknown;quantity:unknown})=>!isSpaceProductId(i.productId)||i.quantity!==1||Object.keys(i).some(k=>!["productId","quantity"].includes(k)))||new Set(value.items.map((i:{productId:string})=>i.productId)).size!==value.items.length)throw Error("PENDING_INVALID");return value}
 if(!isSpaceProductId(value.productId)||value.quantity!==1||Object.keys(value).some(k=>!["productId","quantity","requestId"].includes(k)))throw Error("PENDING_INVALID");return value;
}
function initialCart(){let draft:unknown=[];try{draft=JSON.parse(localStorage.getItem(DRAFT)||"[]")}catch{/* Invalid drafts do not create orders. */}const saved=Array.isArray(draft)?draft.filter(isSpaceProductId):[];const requested=new URLSearchParams(location.search).get("package");return [...new Set([...saved,...(isSpaceProductId(requested)?[requested]:[])])].sort()}
export default function CartStore(){
 const [selected,setSelected]=useState<SpaceProductId[]>(initialCart),[packages,setPackages]=useState<Package[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[receipt,setReceipt]=useState<Receipt|null>(null),[animateReceipt,setAnimateReceipt]=useState(false),[focus,setFocus]=useState(false);
 const [user,setUser]=useState<User|null>(null),[socialBusy,setSocialBusy]=useState(false),[guestHistory,setGuestHistory]=useState(false),[accountError,setAccountError]=useState("");
 const activeUid=useRef<string|null>(null);
 const [authRevision,setAuthRevision]=useState(0),[authReady,setAuthReady]=useState(false);
 const receiptTitle=useRef<HTMLHeadingElement>(null),paying=useRef(false),restoreVersion=useRef(0);
 const available=selected.length>0&&selected.every(id=>packages.some(p=>p.id===id&&p.active)),total=selected.reduce((n,id)=>n+(packages.find(p=>p.id===id)?.price||0),0),locked=busy||uncertain||socialBusy;
 useEffect(()=>{const c=new AbortController();fetch(API+"catalog",{cache:"no-store",signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setPackages((await r.json()).packages)}).catch(e=>{if(e.name!=="AbortError")setError("가격과 공개 상태를 불러오지 못했습니다. 잠시 후 다시 접속해 주세요.")}).finally(()=>setLoading(false));return()=>c.abort()},[]);
 useEffect(()=>{if(!locked&&!receipt)try{localStorage.setItem(DRAFT,JSON.stringify(selected))}catch{/* Selection still works without draft storage. */}},[selected,locked,receipt]);
 useEffect(()=>{
  if(!auth||!configured)return;
  return onIdTokenChanged(auth,current=>{
   const changed=activeUid.current!==current?.uid;
   activeUid.current=current?.uid||null;setUser(current);setAuthReady(true);setAuthRevision(n=>n+1);
   if(changed){restoreVersion.current++;setReceipt(null);setAnimateReceipt(false);setUncertain(false);setConsent(false);setError("");setAccountError("");setGuestHistory(false)}
  });
 },[]);
 useEffect(()=>{let active=true;const generation=restoreVersion.current,isCurrent=()=>active&&generation===restoreVersion.current&&auth?.currentUser?.uid===user?.uid;
  if(!user||!auth||paying.current)return()=>{active=false};
  void (async()=>{
   const raw=localStorage.getItem("smartspace-pending:"+user.uid),id=localStorage.getItem("smartspace-receipt:"+user.uid);
   setGuestHistory(user.isAnonymous&&!!(raw||id||localStorage.getItem("smartspace-guest-history:"+user.uid)));
   if(raw){const prior=pendingRequest(raw);if(isCurrent()){setSelected(requestIds(prior));setUncertain(true);setConsent(true)}return}
   if(!id)return;
   const r=await fetch(API+"receipt?paymentId="+encodeURIComponent(id),{headers:{Authorization:"Bearer "+await user.getIdToken()},cache:"no-store"});
   if(!r.ok){if(isCurrent())setError("이전 주문을 확인하지 못했습니다. 현재 선택은 유지됩니다.");return}
   const data:Receipt=await r.json(),requested=new URLSearchParams(location.search).get("package");
   if(isCurrent()&&(!requested||data.productId===requested||data.items?.some(i=>i.productId===requested)))setReceipt(data);
  })().catch(()=>{if(isCurrent())setError("진행 중인 주문 정보를 확인하지 못했습니다. 새 주문을 만들기 전에 기존 결과를 확인해 주세요.")});
  return()=>{active=false};
 },[user?.uid,user?.isAnonymous,authRevision]);
 function allowSocialLogin(provider:"google"|"kakao"|"naver"){
  if(paying.current||busy||uncertain)return false;
  const current=auth?.currentUser;
  if(provider==="google"||!current?.isAnonymous)return true;
  try{return !["smartspace-pending:","smartspace-receipt:","smartspace-guest-history:"].some(prefix=>localStorage.getItem(prefix+current.uid))}
  catch{return false}
 }
 async function logout(){
  if(locked||paying.current||!auth)return;
  try{setAccountError("");await signOut(auth)}
  catch{setAccountError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.")}
 }
 useEffect(()=>{if(receipt)receiptTitle.current?.focus()},[receipt?.paymentId]);
 function choose(id:SpaceProductId,value:boolean){if(locked)return;restoreVersion.current++;setSelected(current=>(value?[...new Set([...current,id])]:current.filter(x=>x!==id)).sort());setConsent(false);setError("")}
 async function pay(){
  if((!uncertain&&(!available||!consent))||!auth||!configured||busy||socialBusy||paying.current)return;paying.current=true;restoreVersion.current++;setBusy(true);setError("");
  try{
   await auth.authStateReady();const user=auth.currentUser||(await signInAnonymously(auth)).user,key="smartspace-pending:"+user.uid,raw=localStorage.getItem(key);
   const paymentUid=user.uid;
   const request:Pending=raw?pendingRequest(raw):{items:selected.map(productId=>({productId,quantity:1})),requestId:crypto.randomUUID()};
   if(JSON.stringify(requestIds(request))!==JSON.stringify([...selected].sort())){setSelected(requestIds(request));setUncertain(true);setConsent(true);setError("이미 진행 중인 구성이 있어 해당 주문 결과를 먼저 확인합니다.");return}
   localStorage.setItem(key,JSON.stringify(request));setUncertain(true);
   const r=await fetch(API+("items" in request?"cart-checkout":"checkout"),{method:"POST",headers:{Authorization:"Bearer "+await user.getIdToken(),"Content-Type":"application/json"},body:JSON.stringify(request),signal:AbortSignal.timeout(30000),cache:"no-store"});
   if(auth.currentUser?.uid!==paymentUid)return;
   if(r.status===202){setError("주문 요청을 저장했습니다. 판매자 내역 반영을 처리 중입니다. 같은 주문 결과 다시 확인을 눌러 복구할 수 있습니다.");return}
   if(!r.ok){const failure=await r.json().catch(()=>({}));if(["PACKAGE_UNAVAILABLE","PACKAGE_CHANGED"].includes(failure.error)){localStorage.removeItem(key);setUncertain(false);setConsent(false);setPackages([]);setError("구성 중 구매할 수 없거나 가격이 바뀐 패키지가 있습니다. 새로고침하여 현재 구성을 다시 확인해 주세요.");return}throw Error("CHECKOUT_UNAVAILABLE")}
   const result:Receipt=await r.json();if(result.status!=="MOCK_APPROVED")throw Error("UNEXPECTED_STATUS");
   if(user.isAnonymous){localStorage.setItem("smartspace-guest-history:"+user.uid,"true");setGuestHistory(true)}
   localStorage.setItem("smartspace-receipt:"+user.uid,result.paymentId);localStorage.removeItem(key);localStorage.removeItem(DRAFT);setAnimateReceipt(true);setReceipt(result);setUncertain(false);
  }catch{setError("모의 결제 결과를 확인하지 못했습니다. 같은 주문 결과 다시 확인을 누르면 같은 구성과 요청 번호로 복구합니다. 중복 주문을 만들지 않습니다.")}
  finally{paying.current=false;setBusy(false)}
 }
 function again(){restoreVersion.current++;setAnimateReceipt(false);if(auth?.currentUser)localStorage.removeItem("smartspace-receipt:"+auth.currentUser.uid);setReceipt(null);setConsent(false);setSelected([]);setError("")}
 const accountPanel = <details className="customer-account" id="account" open={user&&!user.isAnonymous?true:undefined}><summary><span>내 계정 · 간편로그인</span><span className="account-summary-hint">선택 사항</span></summary><div className="account-content">
    <div className="customer-account-bar"><div><h2 id="customer-account-title">{user&&!user.isAnonymous?"내 계정":"간편하게 로그인하고 둘러보세요"}</h2>
     <p>{user&&!user.isAnonymous?(user.displayName||user.email||"간편로그인 계정")+"으로 로그인했습니다.":"로그인 없이 공간을 체험할 수 있습니다. 비회원 모의 주문도 기존처럼 이용할 수 있습니다."}</p></div>
     {user&&!user.isAnonymous&&<button type="button" className="account-signout" disabled={locked} onClick={()=>void logout()}>로그아웃</button>}
    </div>
    {(!user||user.isAnonymous)&&<SocialLogin auth={authReady?auth:null} allowLogin={allowSocialLogin} apiOrigin={API_ORIGIN} disabled={busy||uncertain} blockCustomForGuest={!!user?.isAnonymous&&guestHistory} onBusyChange={setSocialBusy}/>}
    {accountError&&<p className="account-error" role="alert">{accountError}</p>}
    {uncertain&&<p className="social-help">확인 중인 주문 결과를 먼저 확인한 뒤 계정을 바꿀 수 있습니다.</p>}
   </div></details>;
 const step=receipt?3:busy||consent||uncertain?2:1;
 return <>
  <header className="site-header"><a className="logo" href="/">paybridge<small>SMART HOME</small></a><nav aria-label="사이트 메뉴"><a href="/bedroom/">침실 체험</a><a href="/kitchen/">주방 체험</a><a href="#packages">공간 패키지</a><a href="#account" onClick={()=>{const panel=document.getElementById("account") as HTMLDetailsElement|null;if(panel)panel.open=true}}>내 계정</a></nav></header>
  <main className="smart-main"><p className="mock-notice">공간을 체험하는 모의 스토어입니다. 실제 결제·배송·기기 연결은 없습니다.</p>
   <p className="sr-only" role="status" aria-live="polite">{receipt?"모의 주문이 완료되었습니다.":busy?"모의 주문 결과 확인 중":uncertain?"기존 주문 결과 확인이 필요합니다.":`${selected.length}개 패키지 선택, ${available?money(total):"가격 확인 필요"}`}</p>
   {receipt?<section className={animateReceipt?"completion celebrate":"completion"} aria-labelledby="complete-title"><span className="success-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M10 21l7 7 14-16"/></svg></span><p className="eyebrow" role="status">MOCK ORDER COMPLETE</p><h1 id="complete-title" ref={receiptTitle} tabIndex={-1}>모의 결제가 완료되었습니다.</h1><p>선택한 패키지가 한 주문으로 기록되었어요.</p><div className="receipt-card"><h2>{receipt.productName}</h2><ul className="cart-receipt-items" aria-label="주문 구성">{receipt.items?.map(i=><li key={i.productId}><span>{i.productName} · {i.quantity}개</span><strong>{money(i.lineTotal)}</strong></li>)}</ul><strong>{money(receipt.amount)}</strong><dl><dt>패키지 수량</dt><dd>{receipt.quantity}개</dd><dt>주문 번호</dt><dd>{receipt.orderId}</dd><dt>결제 번호</dt><dd>{receipt.paymentId}</dd><dt>상태</dt><dd>모의 승인 · 실제 청구 없음</dd><dt>기록 시각</dt><dd>{new Date(receipt.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</dd></dl><p>판매자·관리자 주문 내역에도 같은 구성과 합계가 반영됩니다.</p></div><button className="primary" onClick={again}>스토어로 돌아가기</button></section>:<>
    <section className="store-hero"><div className="hero-copy"><span className="eyebrow">SMALL CHANGES, BETTER LIVING</span><p className="hero-kicker">나의 일상에 맞춘 스마트홈</p><h1>공간을 바꾸는 빛,<br/>일상을 바꾸는 경험.</h1><p>침실의 포근한 밤부터 주방의 편리한 순간까지.<br/>직접 체험하고, 내 공간에 맞게 골라보세요.</p><div className="hero-actions"><a className="primary link-button" href="/bedroom/">침실부터 체험하기 <span aria-hidden="true">↗</span></a><a className="hero-secondary" href="#packages">모든 패키지 보기</a></div><div className="hero-index"><span>01 / BEDROOM</span><span>따뜻한 밤의 휴식</span></div></div><div className="hero-visual"><img src={spacePackages['bedroom-lighting'].image} alt="은은한 조명으로 꾸민 침실 공간"/><span className="hero-image-tag">당신의 공간을 상상해 보세요</span></div></section>
    {accountPanel}
   <ol className="purchase-steps" aria-label="모의 구매 진행 단계">{["패키지 함께 선택","합계·모의 결제 확인","주문 완료"].map((label,i)=><li key={label} className={step===i+1?"current":step>i+1?"done":""} aria-current={step===i+1?"step":undefined}><span aria-hidden="true">{step>i+1?"완료":String(i+1).padStart(2,"0")}</span>{label}</li>)}</ol>
    <nav className="space-shortcuts" aria-label="공간별 패키지 바로가기">{ids.map((id,i)=><a key={id} href={`#${id}`}><span className="space-number">0{i+1}</span><div><strong>{spacePackages[id].space}</strong><small>{id==="bedroom-lighting"?"따뜻한 밤의 휴식":id==="kitchen-sensing"?"필요한 순간의 빛":"나만의 집중 시간"}</small></div><span aria-hidden="true">→</span></a>)}</nav><section className="space-heading"><div><span className="eyebrow">BUILD YOUR SPACE</span><h2 id="packages">내 공간을 위한 세 가지 선택</h2></div><span className="space-pill">각 패키지 1개씩 · 최대 3종</span></section>
    <div className="purchase-layout cart-layout"><section aria-labelledby="package-title"><h2 id="package-title" className="cart-heading">필요한 만큼 함께 선택하세요.</h2>{ids.map(id=>{const detail=spacePackages[id],pack=packages.find(p=>p.id===id&&p.active),checked=selected.includes(id);return <article key={id} data-product={id} id={id} className="cart-product"><label className={checked?"shop-package chosen":"shop-package"}><input aria-label={`${detail.space} 패키지 선택`} type="checkbox" checked={checked} disabled={locked||!pack} onChange={e=>choose(id,e.target.checked)}/><span className={id==='desk-focus'&&focus?"desk-preview focus-on":"desk-preview"}><img src={detail.image} alt={detail.name}/></span><div><span className="eyebrow">{detail.category}</span><h3>{pack?.name||detail.name}</h3><p>{detail.description}<br/>{detail.caption}</p><strong>{pack?money(pack.price):loading?"가격 확인 중…":"현재 구매할 수 없습니다"}</strong><small>예시 가격 · 실제 판매 상품이 아닙니다</small></div></label>{id==='desk-focus'?<div className="desk-mode"><button type="button" role="switch" aria-label="데스크 가상 집중 모드" aria-checked={focus} onClick={()=>setFocus(!focus)}>{focus?"집중 모드 켜짐":"집중 모드 꺼짐"}</button><span>책상 그림의 가상 빛만 바뀝니다.</span></div>:<a className="text-link" href={detail.experience}>{detail.space} 3D 체험하기 ↗</a>}</article>})}</section>
    <section className="checkout-card cart-checkout" id="checkout" aria-busy={busy} aria-labelledby="checkout-title"><p className="eyebrow">YOUR SPACE COLLECTION</p><span className="selection-count">{selected.length} / 3 선택</span><h2 id="checkout-title">{selected.length?"선택한 패키지":"패키지를 선택해 주세요"}</h2>{selected.length===0&&<p className="cart-empty">마음에 드는 공간의 패키지를 선택하면<br/>이곳에 구성과 합계가 모입니다.</p>}<ul className="cart-summary" aria-label="선택 구성">{selected.map(id=><li key={id}><span>{spacePackages[id].name} · 1개</span><strong>{packages.find(p=>p.id===id)?money(packages.find(p=>p.id===id)!.price):"확인 필요"}</strong></li>)}</ul><div className="checkout-total"><span>{selected.length}종 · 모의 결제 합계</span><strong data-testid="cart-total">{available?money(total):selected.length?"확인 필요":"0원"}</strong></div><p className="fine">패키지별 1개, 배송비·추가 청구 없음. 선택한 구성의 합계를 확인하세요.</p><label className="mock-consent"><input type="checkbox" checked={consent} disabled={!available||busy||uncertain||socialBusy} onChange={e=>{restoreVersion.current++;setConsent(e.target.checked)}}/><span>선택한 구성과 합계를 확인했으며, 실제 청구·배송 없는 모의 주문 저장에 동의합니다.</span></label><button className="primary" onClick={()=>void pay()} disabled={(!uncertain&&(!available||!consent))||busy||socialBusy||!configured}>{busy&&<span className="pending-spinner" aria-hidden="true"/>}{busy?"모의 결제 결과 확인 중…":uncertain?"같은 주문 결과 다시 확인":"바로 구매 · 모의 결제"}</button><p className="fine">카드번호·결제 비밀번호를 입력받지 않습니다.</p>{!configured&&<p role="status">결제 연결 설정을 확인 중입니다.</p>}<p className="cart-saved">체험 화면에 다녀와도 선택을 이어갑니다. 확인 중인 주문은 구성을 바꿀 수 없습니다.</p></section></div>
   </>}{receipt&&accountPanel}{error&&<p className="error" role="alert">{error}</p>}
  </main><footer className="smart-footer">PAYBRIDGE · 공간을 연결하는 작은 편리함<span>공간 체험과 모의 구매를 위한 스토어</span></footer>
 </>;
}
