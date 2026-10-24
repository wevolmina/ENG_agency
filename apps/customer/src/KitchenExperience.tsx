import {useEffect,useRef,useState} from "react";
import type {KitchenScene} from "./kitchen3d";
import flatKitchen from "./assets/kitchen-flat.svg?raw";
import "./bedroom.css";
import "./bedroom-atmosphere.css";
import "./kitchen.css";

export default function KitchenExperience(){
 const [selected,setSelected]=useState(false),[presence,setPresence]=useState(false),[door,setDoor]=useState(false),[view,setView]=useState(0);
 const [mode,setMode]=useState<"3d"|"flat">(new URLSearchParams(location.search).get("view")==="flat"?"flat":"3d"),[ready,setReady]=useState(false),[failure,setFailure]=useState("");
 const host=useRef<HTMLDivElement>(null),scene=useRef<KitchenScene|null>(null),current=useRef({presence,door,view});current.current={presence,door,view};
 const on=selected&&(presence||door);
 useEffect(()=>{
  if(mode!=="3d")return;let cancelled=false,instance:KitchenScene|undefined;setReady(false);
  void import("./kitchen3d").then(({mountKitchen})=>{if(cancelled||!host.current)return;instance=mountKitchen(host.current,()=>{setFailure("3D 연결이 중단되어 가벼운 그림으로 바꿨어요. 센서 체험과 구매는 계속할 수 있습니다.");setMode("flat")});scene.current=instance;instance.setState(current.current.presence,current.current.door);instance.setView(current.current.view);setReady(true)}).catch(()=>{if(!cancelled){host.current?.replaceChildren();setFailure("3D를 열지 못해 가벼운 그림으로 바꿨어요. 센서 체험과 구매는 계속할 수 있습니다.");setMode("flat")}});
  return()=>{cancelled=true;instance?.dispose();if(scene.current===instance)scene.current=null};
 },[mode]);
 useEffect(()=>{scene.current?.setState(presence,door)},[presence,door]);useEffect(()=>{scene.current?.setView(view)},[view]);
 function choose(value:boolean){setSelected(value);if(!value){setPresence(false);setDoor(false)}}
 function reset(){choose(false);setView(0)}
 const reason=presence&&door?"사람 감지 + 문 열림":presence?"사람 감지":door?"문 열림":"감지 없음";
 return <>
  <header className="room-header"><a className="room-brand" href="/">paybridge <small>SPACE EXPERIENCE</small></a><a href="/bedroom/">침실도 체험하기 ↗</a></header>
  <main className="room-main"><p className="room-crumb"><a href="/">공간 체험</a> / 주방 / 센서 조명 패키지</p>
   <div className="room-intro"><div><p className="room-eyebrow">A LITTLE HELP IN YOUR EVERYDAY</p><h1>나를 반기는 주방의 빛.</h1><p>가상 센서를 눌러, 사람이 있거나 문이 열릴 때 켜지는 빛을 만나보세요.</p></div><span className="room-demo">모의 체험 · 실제 센서 연결 없음</span></div>
   <ol className="room-steps" aria-label="주방 체험에서 구매까지"><li className={selected?"done":"current"}><span>01</span> 패키지 선택</li><li className={selected?"current":""}><span>02</span> 센서 상태 체험</li><li><span>03</span> 모의 구매</li></ol>
   <div className="room-layout"><section className="room-stage" aria-label="가상 주방 체험">
    <div className="room-scene-top"><span>02 / KITCHEN</span><span>{mode==="3d"?"3D 공간":"가벼운 2D 그림"}</span></div>
    <div className="room-viewport kitchen-viewport" data-presence={presence} data-door={door} data-light={on?"on":"off"}>
     <div ref={host} className="room-canvas" hidden={mode!=="3d"} role="img" aria-label={`가상 3D 주방, ${reason}, 작업대 조명 ${on?"켜짐":"꺼짐"}`}/>
     {mode==="3d"&&!ready&&<p className="room-loading" role="status">3D 주방을 준비하고 있어요…</p>}
     {mode==="flat"&&<div className="room-flat" role="img" aria-label={`가상 주방 그림, ${reason}, 조명 ${on?"켜짐":"꺼짐"}`} dangerouslySetInnerHTML={{__html:flatKitchen}}/>}
     <button className={selected?"room-hotspot selected":"room-hotspot"} aria-pressed={selected} aria-label="주방 센서 조명 패키지 선택" onClick={()=>choose(!selected)}>{selected?"✓":"+"}<span>{selected?"패키지 선택됨":"센서 조명 패키지"}</span></button>
     <span className={on?"kitchen-result on":"kitchen-result"}>작업대 조명 {on?"켜짐":"꺼짐"}</span>
    </div>
    <div className="room-scene-bottom"><div><strong>{on?"필요한 순간, 작업대를 밝게":"조용히 다음 순간을 기다려요"}</strong><p>{reason} · 화면 입력으로만 바뀌는 가상 상태</p></div><span className={on?"room-dot on":"room-dot"} aria-hidden="true"/></div>
    <div className="kitchen-quick" role="group" aria-label="장면 센서 빠른 체험"><button disabled={!selected} aria-pressed={presence} onClick={()=>setPresence(!presence)}>사람 {presence?"나가기":"들어오기"}</button><button disabled={!selected} aria-pressed={door} onClick={()=>setDoor(!door)}>수납장 문 {door?"닫기":"열기"}</button></div>
    <div className="room-view-controls"><div className="room-angles" role="group" aria-label="주방 보는 각도">{["전체 보기","정면 보기","옆에서 보기"].map((label,i)=><button key={label} disabled={mode!=="3d"||!ready} aria-pressed={view===i} onClick={()=>setView(i)}>{label}</button>)}</div><button className="room-flat-button" onClick={()=>{setFailure("");setMode(mode==="3d"?"flat":"3d")}}>{mode==="3d"?"가벼운 그림으로 보기":"3D로 다시 보기"}</button></div>
    {failure&&<p className="room-fallback-message" role="status">{failure}</p>}<p className="room-render-note">입력할 때만 장면이 바뀝니다. 실제 사람·문·센서의 상태를 읽거나 전송하지 않습니다.</p>
   </section>
   <section className="room-side" aria-labelledby="kitchen-package-title"><p className="room-eyebrow">KITCHEN ESSENTIAL / 02</p><h2 id="kitchen-package-title">주방 센서 조명 패키지</h2><p className="room-description">재실 센서 + 문 열림 센서 + 작업대 조명.<br/>일상의 작은 움직임을 빛으로 이어 보세요.</p>
    <label className={selected?"room-package chosen":"room-package"}><input id="kitchen-package" type="checkbox" checked={selected} onChange={e=>choose(e.target.checked)}/><span className="room-package-icon" aria-hidden="true">◉</span><span><strong>주방 센서 조명 패키지</strong><small>가상 재실·문 열림 → 작업대 조명</small><b>{selected?"선택됨":"패키지 선택하기"}</b></span></label>
    <fieldset className="kitchen-sensors" disabled={!selected}><legend>가상 센서 직접 바꾸기</legend><div className="kitchen-sensor"><div><h3 id="presence-label">가상 재실 감지</h3><p>{presence?"사람 있음 · 화면 속 인물 표시":"사람 없음"}</p></div><button role="switch" aria-labelledby="presence-label" aria-checked={presence} className="room-switch" onClick={()=>setPresence(!presence)}><span/></button></div><div className="kitchen-sensor"><div><h3 id="door-label">가상 수납장 문 열림</h3><p>{door?"문 열림 · 화면 속 문 열기":"문 닫힘"}</p></div><button role="switch" aria-labelledby="door-label" aria-checked={door} className="room-switch" onClick={()=>setDoor(!door)}><span/></button></div></fieldset>
    <div className="kitchen-rule"><strong>사람 감지 또는 문 열림 → 조명 켜짐</strong><p>둘 다 감지되지 않을 때 조명이 꺼집니다. 타이머나 실제 자동화 설정을 저장하지 않습니다.</p></div>
    <p className="room-status" role="status" aria-live="polite">{!selected?"주방 패키지를 먼저 선택해 주세요.":`${reason} → 작업대 조명 ${on?"켜짐":"꺼짐"}`}</p>
    <div className="room-price"><span>예시 가격 · 실제 청구 없음</span><strong>99,000<small>원</small></strong></div>
    <div className="room-purchase-bar"><span className="room-mobile-price">모의 구매 · 실제 청구 없음<strong>99,000원</strong></span><a id="buy-kitchen" className="room-buy" href={selected?"/?package=kitchen-sensing#checkout":undefined} aria-disabled={!selected} tabIndex={selected?0:-1}>주방 패키지 모의 구매하기 ↗</a></div>
    <p className="room-purchase-note">다음 화면에서 동의하면 모의 주문이 저장됩니다.<br/>체험한 센서 상태는 주문이나 실제 기기에 저장되지 않습니다.</p><button className="room-reset" onClick={reset}>선택과 센서 초기화</button>
    <div className="room-boundary"><strong>화면 안에서만 만나는 스마트 주방</strong><p>실제 결제·배송·기기 연결은 없습니다. 센서 감지 성능이나 안전 기능을 보장하는 시연이 아닙니다. 움직임 줄이기 설정을 따릅니다.</p></div>
   </section></div>
  </main><footer className="room-footer"><span>PAYBRIDGE · 주방에서 시작하는 작은 편리함</span><span>자체 제작 3D · 외부 모델·유료 자산 없음</span></footer>
 </>;
}
