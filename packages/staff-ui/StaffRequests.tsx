"use client";
import {useEffect,useRef,useState} from "react";
import type {Auth,User} from "firebase/auth";
import "./staff-access.css";
type Role="merchant"|"admin";
type Result={ready:boolean;requests:{request_id:string;role:Role;status:"pending"|"approved"|"rejected";reason:string}[];memberships:{role:Role;active:boolean;otherStore:boolean}[]};
const names={merchant:"판매자",admin:"관리자"};
const messages:Record<string,string>={SIGN_IN_REQUIRED:"다시 로그인해 주세요.",APPLICATIONS_NOT_READY:"마스터 계정 등록이 끝나면 신청할 수 있습니다.",ROLE_ALREADY_ACTIVE:"이미 승인된 역할입니다. 신청 상태를 다시 확인해 주세요.",ACCOUNT_OTHER_STORE:"이 역할은 다른 상점에 연결되어 있어 신청할 수 없습니다.",ACCOUNT_DISABLED:"사용 중지된 계정입니다.",ACCOUNT_LOGIN_REQUIRED:"비회원 계정은 신청할 수 없습니다. 정식 계정으로 로그인해 주세요."};
export default function StaffRequests({auth,user,apiOrigin,defaultRole,onChanged,onBusyChange}:{auth:Auth;user:User;apiOrigin:string;defaultRole:Role;onChanged:()=>void;onBusyChange:(busy:boolean)=>void}) {
 const [data,setData]=useState<Result|null>(null),[role,setRole]=useState<Role>(defaultRole),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const live=useRef(false),generation=useRef(0),working=useRef(false),controllers=useRef(new Set<AbortController>()),callbacks=useRef({onChanged,onBusyChange});callbacks.current={onChanged,onBusyChange};
 const endpoint=apiOrigin.replace(/\/$/,"")+"/api/staff/requests";
 async function request(submit?:Role) {
  const seq=generation.current;
  const valid=()=>live.current&&seq===generation.current&&auth.currentUser?.uid===user.uid;
  if(!valid())throw Error("STALE_ACCOUNT");const token=await user.getIdToken();if(!valid())throw Error("STALE_ACCOUNT");
  const controller=new AbortController();controllers.current.add(controller);const timeout=setTimeout(()=>controller.abort(),15000);
  try {const response=await fetch(endpoint,{method:submit?"POST":"GET",credentials:"omit",cache:"no-store",signal:controller.signal,
    headers:{Authorization:"Bearer "+token,...(submit?{"Content-Type":"application/json"}:{})},...(submit?{body:JSON.stringify({role:submit})}:{})});
   const result=await response.json();if(!valid())throw Error("STALE_ACCOUNT");if(!response.ok)throw Error(result.error||"APPLICATION_UNAVAILABLE");return result;
  }finally{clearTimeout(timeout);controllers.current.delete(controller)}
 }
 async function refresh(){const result:Result=await request();setData(result);return result;}
 useEffect(()=>{
  live.current=true;generation.current++;const seq=generation.current;setData(null);setRole(defaultRole);setError("");setNotice("");setBusy(false);
  void refresh().catch(e=>{if(live.current&&seq===generation.current)setError(messages[e.message]||"신청 상태를 확인하지 못했습니다. 다시 확인해 주세요.")});
  return()=>{live.current=false;generation.current++;for(const c of controllers.current)c.abort();callbacks.current.onBusyChange(false)};
 },[user.uid,endpoint,defaultRole]);
 const pending=data?.requests.some(r=>r.status==="pending");
 useEffect(()=>{
  if(!pending)return;
  const timer=setInterval(()=>{if(document.visibilityState!=="hidden"&&!working.current)void refresh().then(result=>{if(!result.requests.some(r=>r.status==="pending"))callbacks.current.onChanged()}).catch(()=>{})},15000);
  return()=>clearInterval(timer);
 },[pending,user.uid,endpoint]);
 async function run(submit?:Role){
  if(working.current)return;working.current=true;setBusy(true);callbacks.current.onBusyChange(true);setError("");setNotice("");
  try{if(submit)await request(submit);await refresh();if(submit)setNotice(names[submit]+" 신청을 접수했습니다. 마스터의 승인을 기다려 주세요.");else callbacks.current.onChanged();}
  catch(e){if(live.current&&(e as Error).message!=="STALE_ACCOUNT")setError(messages[(e as Error).message]||"신청 결과를 확인하지 못했습니다. 신청 상태를 다시 확인해 주세요.")}
  finally{working.current=false;if(live.current){setBusy(false);callbacks.current.onBusyChange(false)}}
 }
 const membership=data?.memberships.find(m=>m.role===role),application=data?.requests.find(r=>r.role===role),active=membership?.active&&!membership.otherStore;
 return <section className="staff-access card" aria-labelledby="staff-request-heading">
  <div className="staff-access-heading"><div><p className="eyebrow">ACCESS REQUEST</p><h2 id="staff-request-heading">이용 권한 신청</h2></div><button type="button" disabled={busy} onClick={()=>void run()}>신청 상태 확인</button></div>
  <p>로그인한 계정으로 신청합니다. 계정 고유번호를 따로 전달할 필요가 없습니다.</p>
  {!data&&!error&&<p role="status">신청 상태를 확인하고 있습니다.</p>}
  {data&&!data.ready&&<p>마스터 계정 등록이 끝나면 신청할 수 있습니다.</p>}
  <form className="access-form" onSubmit={e=>{e.preventDefault();void run(role)}}>
   <label>신청 역할<select aria-label="신청 역할" value={role} disabled={busy} onChange={e=>{setRole(e.target.value as Role);setNotice("")}}><option value="merchant">판매자</option><option value="admin">관리자</option></select></label>
   {active?<p role="status">{names[role]} 권한이 승인되어 있습니다.</p>:application?.status==="pending"?<p role="status">{names[role]} 신청을 검토 중입니다. 승인 전에는 해당 기능을 사용할 수 없습니다.</p>:application?.status==="rejected"?<p role="status">{names[role]} 신청이 거절되었습니다.{application.reason&&" 사유: "+application.reason} 내용을 확인한 뒤 다시 신청할 수 있습니다.</p>:application?.status==="approved"?<p>이전에 승인되었지만 현재 권한은 해제되어 있습니다. 필요하면 다시 신청하세요.</p>:null}
   {membership?.otherStore&&<p>{messages.ACCOUNT_OTHER_STORE}</p>}
   <button className="primary" disabled={busy||!data?.ready||!!active||!!membership?.otherStore||application?.status==="pending"}>{busy?"처리 중":application&&application.status!=="pending"?"다시 신청":names[role]+" 권한 신청"}</button>
  </form>
  {notice&&<p className="access-notice" role="status">{notice}</p>}{error&&<p className="social-error" role="alert">{error}</p>}
 </section>;
}
