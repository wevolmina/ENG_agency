import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {signInAnonymously} from "firebase/auth";


import {auth, configured} from "./firebase";
import "./style.css";

const products = [{id:"starter",name:"데일리 노트",price:12000,description:"생각을 정리하는 하루의 작은 습관",mark:"01",category:"DAILY ESSENTIAL"},{id:"planner",name:"위클리 플래너",price:24000,description:"일주일의 우선순위를 한눈에",mark:"02",category:"WEEKLY ROUTINE"},{id:"bundle",name:"워크 라이프 세트",price:39000,description:"나만의 리듬을 만드는 문구 세트",mark:"03",category:"CURATED SET"}];
const won = (n:number) => new Intl.NumberFormat("ko-KR").format(n) + "원";
type Receipt = {paymentId:string;orderId:string;productName:string;quantity:number;amount:number;createdAt:string;status:string};
function App() {
  const [productId,setProductId] = useState("planner");
  const [quantity,setQuantity] = useState(1);
  const [consent,setConsent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [receipt,setReceipt] = useState<Receipt|null>(null);
  const [paymentId,setPaymentId] = useState("");
  const [recovering,setRecovering] = useState(false);
  const product = products.find(p=>p.id===productId)!;
  async function api(path:string,body?:unknown){
    const user=auth!.currentUser;if(!user)throw new Error("AUTH_REQUIRED");
    const response=await fetch("https://paybridge-mock.vercel.app/api/"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+await user.getIdToken(),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000),cache:"no-store"});
    if(!response.ok)throw new Error((await response.json()).error||"UNAVAILABLE");
    return response.json();
  }
  useEffect(()=>{
    if(!paymentId||!auth)return;
    let active=true;
    void api("receipt?paymentId="+encodeURIComponent(paymentId)).then(value=>{if(active)setReceipt(value);}).catch(()=>{if(active)setError("영수증을 불러오지 못했습니다. 새로고침해 다시 확인해 주세요.");});
    return()=>{active=false;};
  },[paymentId]);
  useEffect(()=>{
    try {
      const raw=localStorage.getItem("bridge-pending");
      if(raw){const pending=JSON.parse(raw);if(products.some(p=>p.id===pending.productId)&&Number.isInteger(pending.quantity)&&pending.quantity>=1&&pending.quantity<=10){setProductId(pending.productId);setQuantity(pending.quantity);setRecovering(true);}}
      if(configured){const stored=localStorage.getItem("bridge-receipt");if(stored)signInAnonymously(auth!).then(()=>setPaymentId(stored)).catch(()=>setError("로그인을 복원하지 못했습니다."));}
    }catch{setError("브라우저 저장 공간을 사용할 수 없습니다. 저장 공간을 허용한 뒤 다시 접속해 주세요.");}
  },[]);
  async function pay() {
    if (!configured || !consent || busy) return;
    setBusy(true);setError("");
    try {
      await signInAnonymously(auth!);
      const raw = localStorage.getItem("bridge-pending");
      const pending = raw ? JSON.parse(raw) : null;
      if (pending && (pending.productId !== productId || pending.quantity !== quantity)) {
        setError("이전 결제의 응답을 확인 중입니다. 이전 상품과 수량으로 다시 시도해 주세요.");return;
      }
      const request = pending || {productId,quantity,requestId:crypto.randomUUID()};
      localStorage.setItem("bridge-pending",JSON.stringify(request));
      setRecovering(true);
      const result = await api("checkout",request);
      localStorage.setItem("bridge-receipt",result.paymentId);
      localStorage.removeItem("bridge-pending");
      setRecovering(false);
      setPaymentId(result.paymentId);
    } catch {setError("결제 결과를 확인하지 못했습니다. 같은 상품과 수량으로 다시 누르면 중복 결제 없이 결과를 확인합니다.");}
    finally {setBusy(false);}
  }
  function reset() {setReceipt(null);setPaymentId("");setConsent(false);setRecovering(false);localStorage.removeItem("bridge-receipt");}
  return <><header><a className="brand" href="/">paybridge<span>페이브릿지</span></a><nav className="store-nav" aria-label="스토어 메뉴"><a href="#products">컬렉션</a><span className="pill">모의 결제 스토어</span></nav></header><main><section className="intro"><span className="eyebrow">STUDIO MINA / THE EVERYDAY COLLECTION</span><h1>작은 선택이 만드는<br/>더 나은 하루.</h1><p>오롯이 나에게 집중하는 시간.<br/>오늘의 일상을 채울 문구를 만나보세요.</p><div className="notice">모의 결제 체험입니다. 실제 금액은 청구되지 않습니다.</div><div className="flow"><b aria-current={!paymentId?"step":undefined}>01 상품 선택</b><span>02 모의 결제</span><span aria-current={receipt?"step":undefined}>03 영수증 확인</span></div></section><section className="checkout" aria-label="결제 영역">
    {recovering && !receipt && <div role="status" className="warning">이전 결제 결과를 확인하고 있습니다. 같은 상품과 수량으로 결제를 다시 눌러 주세요. 중복 거래는 생성되지 않습니다.</div>}
    {!configured && <div role="status" className="warning">서비스 연결 대기 중입니다. Firebase 설정 전에는 결제할 수 없습니다.</div>}
    {receipt ? <div className="receipt"><div className="stamp" role="status">모의 결제 완료</div><h2>주문이 완료되었습니다.</h2><p>STUDIO MINA · 모의 결제 영수증</p><div className="receipt-total">{won(receipt.amount)}</div><dl><dt>상품</dt><dd>{receipt.productName} × {receipt.quantity}</dd><dt>결제 일시</dt><dd>{new Date(receipt.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</dd><dt>결제 번호</dt><dd className="mono">{receipt.paymentId}</dd><dt>결제 기록</dt><dd>모의 승인 완료</dd></dl><p className="fine">실제 카드 승인 내역이 아닌 모의 결제 결과입니다.</p><button onClick={reset}>다른 상품 보기</button></div> : <><div id="products" className="section-title"><div><span className="eyebrow">SHOP THE COLLECTION</span><h2>당신의 일상에 더할 한 가지</h2></div><span>상품 3개</span></div><div className="products">{products.map(p=><label key={p.id} className={productId===p.id?"product selected":"product"}><input type="radio" name="product" checked={productId===p.id} onChange={()=>setProductId(p.id)} disabled={busy||recovering}/><span className={`product-art art-${p.id}`} aria-hidden="true"><span className="paper-object"><span>STUDIO<br/>MINA</span><em>{p.mark}</em></span></span><span className="product-copy"><small className="category">{p.category}</small><b>{p.name}</b><small>{p.description}</small></span><strong>{won(p.price)}</strong></label>)}</div><section className="order-summary" aria-label="주문 요약"><h2>주문 요약</h2><div className="summary-product"><span>{product.name}</span><span>{won(product.price)}</span></div><div className="quantity"><label htmlFor="quantity">수량</label><select id="quantity" value={quantity} disabled={busy||recovering} onChange={e=>setQuantity(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i+1}>{i+1}</option>)}</select></div><p className="summary-note">선택한 상품 {quantity}개 · 실제 배송 없이 진행하는 체험입니다.</p><div className="total" aria-live="polite"><span>총 결제 금액</span><strong>{won(product.price*quantity)}</strong></div><label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>실제 청구가 없는 모의 결제임을 확인했습니다.</span></label><button onClick={pay} disabled={!configured||!consent||busy}>{busy?"결제 결과 확인 중…":`${won(product.price*quantity)} 모의 결제하기`}</button><p className="fine">실제 카드 정보 입력이나 금액 청구가 없습니다.</p></section></>}
    {error && <div role="alert" className="warning">{error}</div>}
  </section></main><footer>PAYBRIDGE / STUDIO MINA<span>일상을 위한 작은 컬렉션 · 모의 결제 체험</span></footer></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
