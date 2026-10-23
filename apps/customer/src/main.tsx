import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {signInAnonymously} from "firebase/auth";
import {doc, onSnapshot} from "firebase/firestore";
import {httpsCallable} from "firebase/functions";
import {auth, db, functions, configured} from "./firebase";
import "./style.css";

const products = [{id:"starter",name:"데일리 노트",price:12000,description:"생각을 정리하는 하루의 작은 습관",mark:"01"},{id:"planner",name:"위클리 플래너",price:24000,description:"일주일의 우선순위를 한눈에",mark:"02"},{id:"bundle",name:"워크 라이프 세트",price:39000,description:"나만의 리듬을 만드는 문구 세트",mark:"03"}];
const won = (n:number) => new Intl.NumberFormat("ko-KR").format(n) + "원";
type Receipt = {paymentId:string;orderId:string;productName:string;quantity:number;amount:number;createdAt:string;syncState:string};
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
  useEffect(()=> {
    if (!paymentId || !db) return;
    return onSnapshot(doc(db,"payments",paymentId), snapshot=>{if(snapshot.exists()) setReceipt(snapshot.data() as Receipt);},()=>setError("영수증을 불러오지 못했습니다. 결제 버튼을 다시 누르지 말고 잠시 후 새로고침해 주세요."));
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
      const result = await httpsCallable<typeof request,{paymentId:string}>(functions!,"createPayment")(request);
      localStorage.setItem("bridge-receipt",result.data.paymentId);
      localStorage.removeItem("bridge-pending");
      setRecovering(false);
      setPaymentId(result.data.paymentId);
    } catch {setError("결제 결과를 확인하지 못했습니다. 같은 상품과 수량으로 다시 누르면 중복 결제 없이 결과를 확인합니다.");}
    finally {setBusy(false);}
  }
  function reset() {setReceipt(null);setPaymentId("");setConsent(false);setRecovering(false);localStorage.removeItem("bridge-receipt");}
  return <><header><a className="brand" href="/">paybridge<span>페이브릿지</span></a><span className="pill">고객 스토어</span></header><main><section className="intro"><span className="eyebrow">STUDIO MINA / CHECKOUT</span><h1>작은 선택이 만드는<br/>더 나은 하루.</h1><p>마음에 드는 문구를 고르고 모의 결제를 경험하세요.<br/>결제 내역은 판매자의 매출 화면으로 이어집니다.</p><div className="notice">모의 결제 체험입니다. 실제 금액은 청구되지 않습니다.</div><div className="flow"><b>01 상품 선택</b><span>02 모의 결제</span><span>03 영수증 확인</span></div></section><section className="checkout" aria-label="결제 영역">
    {recovering && !receipt && <div role="status" className="warning">이전 결제 결과를 확인하고 있습니다. 같은 상품과 수량으로 결제를 다시 눌러 주세요. 중복 거래는 생성되지 않습니다.</div>}
    {!configured && <div role="status" className="warning">서비스 연결 대기 중입니다. Firebase 설정 전에는 결제할 수 없습니다.</div>}
    {receipt ? <div className="receipt"><div className="stamp">결제 완료</div><h2>주문이 접수되었습니다.</h2><p>STUDIO MINA · 모의 결제 영수증</p><div className="receipt-total">{won(receipt.amount)}</div><dl><dt>상품</dt><dd>{receipt.productName} × {receipt.quantity}</dd><dt>결제 일시</dt><dd>{new Date(receipt.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</dd><dt>결제 번호</dt><dd className="mono">{receipt.paymentId}</dd><dt>판매자 화면 반영</dt><dd>{receipt.syncState === "synced" ? "동기화 완료" : "전송 대기 · 자동 재시도 중"}</dd></dl><p className="fine">실제 카드 승인 내역이 아닌 모의 결제 결과입니다.</p><button onClick={reset}>다른 상품 보기</button></div> : <><div className="section-title"><h2>주문 상품</h2><span>03 PRODUCTS</span></div><div className="products">{products.map(p=><label key={p.id} className={productId===p.id?"product selected":"product"}><input type="radio" name="product" checked={productId===p.id} onChange={()=>setProductId(p.id)} disabled={busy||recovering}/><span className="product-art">{p.mark}</span><span className="product-copy"><b>{p.name}</b><small>{p.description}</small></span><strong>{won(p.price)}</strong></label>)}</div><div className="quantity"><label htmlFor="quantity">수량</label><select id="quantity" value={quantity} disabled={busy||recovering} onChange={e=>setQuantity(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i+1}>{i+1}</option>)}</select></div><div className="total"><span>총 결제 금액</span><strong>{won(product.price*quantity)}</strong></div><label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>실제 청구가 없는 모의 결제임을 확인했습니다.</span></label><button onClick={pay} disabled={!configured||!consent||busy}>{busy?"결제 결과 확인 중…":`${won(product.price*quantity)} 모의 결제하기`}</button><p className="fine">금액은 서버에서 상품과 수량을 기준으로 다시 계산합니다.</p></>}
    {error && <div role="alert" className="warning">{error}</div>}
  </section></main><footer>PAYBRIDGE · 하나의 거래, 서로 다른 두 화면<span>고객 영수증 / 판매자 매출 관리</span></footer></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
