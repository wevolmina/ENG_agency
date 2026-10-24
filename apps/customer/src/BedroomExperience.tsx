import {useEffect,useRef,useState} from "react";
import type {BedroomScene} from "./bedroom3d";
import flatRoom from "./assets/bedroom-flat.svg?raw";
import "./bedroom.css";

export default function BedroomExperience(){
 const [selected,setSelected]=useState(false),[on,setOn]=useState(false),[view,setView]=useState(0);
 const [mode,setMode]=useState<"3d"|"flat">(new URLSearchParams(location.search).get("view")==="flat"?"flat":"3d");
 const [ready,setReady]=useState(false),[failure,setFailure]=useState("");
 const host=useRef<HTMLDivElement>(null),scene=useRef<BedroomScene|null>(null);
 const lightValue=useRef(false),viewValue=useRef(0);
 lightValue.current=on;viewValue.current=view;
 useEffect(()=>{
  if(mode!=="3d")return;
  let cancelled=false,instance:BedroomScene|undefined;
  setReady(false);
  void import("./bedroom3d").then(({mountBedroom})=>{
   if(cancelled||!host.current)return;
   instance=mountBedroom(host.current,()=>{setFailure("3D 화면 연결이 중단되어 가벼운 그림으로 전환했어요. 선택과 구매는 계속할 수 있습니다.");setMode("flat");},()=>setSelected(true));
   scene.current=instance;instance.setLight(lightValue.current);instance.setView(viewValue.current);setReady(true);
  }).catch(()=>{if(!cancelled){host.current?.replaceChildren();setFailure("이 환경에서는 3D 화면을 열지 못해 가벼운 그림으로 전환했어요. 선택과 구매는 계속할 수 있습니다.");setMode("flat");}});
  return()=>{cancelled=true;instance?.dispose();if(scene.current===instance)scene.current=null;};
 },[mode]);
 useEffect(()=>{scene.current?.setLight(on)},[on]);
 useEffect(()=>{scene.current?.setView(view)},[view]);
 function choose(value:boolean){setSelected(value);if(!value)setOn(false)}
 function reset(){choose(false);setView(0)}
 return <><header className="room-header"><a className="room-brand" href="/">paybridge <small>SPACE EXPERIENCE</small></a><a href="/">스토어로 돌아가기 ↗</a></header><main className="room-main"><p className="room-crumb">공간 체험 / 침실 / 조명 패키지</p><div className="room-intro"><div><p className="room-eyebrow">A QUIETER END TO YOUR DAY</p><h1>빛이 머무는 나의 침실.</h1><p>작은 방을 둘러보고, 나에게 맞는 밤의 분위기를 찾아보세요.</p></div><span className="room-demo">모의 체험 · 실제 기기 연결 없음</span></div><div className="room-layout"><section className="room-stage" aria-label="가상 침실 체험"><div className="room-scene-top"><span>01 / BEDROOM</span><span>{mode==="3d"?"3D 공간":"가벼운 2D 그림"}</span></div><div className="room-viewport" data-mode={mode}><div className="room-canvas" ref={host} role="img" aria-label={`직접 제작한 가상 3D 침실, 조명 ${on?"켜짐":"꺼짐"}`} hidden={mode!=="3d"}/>{mode==="3d"&&!ready&&<p className="room-loading" role="status">3D 침실을 준비하고 있어요…</p>}{mode==="flat"&&<div className={on?"room-flat lit":"room-flat"} role="img" aria-label={`가상 침실 그림, 조명 ${on?"켜짐":"꺼짐"}`} dangerouslySetInnerHTML={{__html:flatRoom}}/>}<button className={selected?"room-hotspot selected":"room-hotspot"} aria-label="침실 조명 패키지 선택" aria-pressed={selected} onClick={()=>choose(!selected)}>{selected?"✓":"+"}<span>{selected?"패키지 선택됨":"조명 패키지"}</span></button></div><div className="room-scene-bottom"><div><strong>{on?"따뜻한 빛이 머무는 시간":"고요한 빛을 기다리는 시간"}</strong><p>조명 {on?"켜짐":"꺼짐"} · 화면 안에서만 바뀌는 가상 연출</p></div><span className={on?"room-dot on":"room-dot"} aria-hidden="true"/></div><div className="room-view-controls"><div className="room-angles" role="group" aria-label="침실 보는 각도">{["전체 보기","정면 보기","옆에서 보기"].map((label,i)=><button key={label} aria-pressed={view===i} disabled={mode!=="3d"||!ready} onClick={()=>setView(i)}>{label}</button>)}</div><button className="room-flat-button" onClick={()=>{setFailure("");setMode(mode==="3d"?"flat":"3d")}}>{mode==="3d"?"가벼운 그림으로 보기":"3D로 다시 보기"}</button></div><p className="room-render-note">선택과 조명은 아래 버튼으로도 조작할 수 있어요. 조작이 끝나면 3D 렌더링은 쉬어갑니다.</p>{failure&&<p className="room-fallback-message" role="status">{failure}</p>}</section><section className="room-side" aria-labelledby="room-package-title"><p className="room-eyebrow">BEDROOM ESSENTIAL / 01</p><h2 id="room-package-title">편안한 밤 조명 패키지</h2><p className="room-description">협탁의 포근한 빛과 침대 뒤의 은은한 간접 조명.<br/>하루를 마무리하는 나만의 휴식.</p><label className={selected?"room-package chosen":"room-package"}><input id="package" type="checkbox" checked={selected} onChange={e=>choose(e.target.checked)}/><span className="room-package-icon" aria-hidden="true">◒</span><span><strong>침실 조명 패키지</strong><small>협탁 조명 + 헤드보드 간접 조명</small><b>{selected?"선택됨":"패키지 선택하기"}</b></span></label><div className="room-light-control"><div><h3 id="light-label">가상 조명</h3><p>{selected?"스위치로 빛을 비교해 보세요.":"먼저 패키지를 선택해 주세요."}</p></div><button id="light" className="room-switch" type="button" role="switch" aria-checked={on} aria-labelledby="light-label" disabled={!selected} onClick={()=>setOn(!on)}><span/></button></div><p className="room-status" role="status" aria-live="polite">{!selected?"침실 조명 패키지를 선택해 주세요.":on?"가상 조명이 켜졌어요. 따뜻한 빛을 느껴보세요.":"패키지를 선택했어요. 가상 조명을 켜보세요."}</p><div className="room-price"><span>예시 가격 · 실제 청구 없음</span><strong>99,000<small>원</small></strong></div><a id="buy-package" className="room-buy" href={selected?"/?package=bedroom-lighting#checkout":undefined} aria-disabled={!selected} tabIndex={selected?0:-1}>선택한 패키지 모의 구매하기 ↗</a><p className="room-purchase-note">다음 화면에서 모의 결제에 동의하면 주문이 저장됩니다.<br/>카드번호·결제 비밀번호를 입력받지 않습니다.</p><button className="room-reset" onClick={reset}>선택과 조명 초기화</button><div className="room-boundary"><strong>당신의 방을 상상하는 작은 체험</strong><p>직접 제작한 가상 방입니다. 실제 결제·배송·기기 연결은 없습니다. 움직임 줄이기 설정을 사용하면 전환이 즉시 반영됩니다.</p></div></section></div></main><footer className="room-footer"><span>PAYBRIDGE · 한 공간에서 시작하는 스마트홈</span><span>자체 제작 3D · 유료 가구·외부 모델 다운로드 없음</span></footer></>;
}
