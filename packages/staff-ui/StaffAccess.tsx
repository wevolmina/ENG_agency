"use client";
import {useEffect,useRef,useState} from "react";
import type {Auth,User} from "firebase/auth";
import {PrivateInput,PrivateValue} from "./PrivateFields";
import "./staff-access.css";
type Role="merchant"|"admin";
type Member={user_uid:string;role:Role;active:boolean|number;email?:string|null;emailStatus?:string};
type Status={isMaster:boolean;canSetup:boolean;needsRecentLogin:boolean;masterUid?:string;merchantId?:string;members?:Member[];
  history?:{id:number;target_uid:string;role:Role;before_active:boolean|number|null;after_active:boolean|number;created_at:string}[]};
type Account={uid:string;email:string|null;displayName:string|null;providers:string[];memberships:{role:Role;active:boolean;otherStore:boolean}[]};
const roleName=(role:Role)=>role==="admin"?"관리자":"판매자";
const accessDate=(value:string)=>new Date(value.includes("T")?value:value.replace(" ","T")+"Z").toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
const messages:Record<string,string>={
 MASTER_SETUP_NOT_CONFIGURED:"서버의 최초 등록 설정을 먼저 완료해 주세요.",
 MASTER_ACCESS_REQUIRED:"등록된 마스터 구글 계정만 계정을 승인할 수 있습니다.",
 SIGN_IN_REQUIRED:"다시 로그인해 주세요.",RECENT_LOGIN_REQUIRED:"계정 보호를 위해 로그아웃 후 구글로 다시 로그인해 주세요. 로그인 후 5분 안에 변경할 수 있습니다.",
 MASTER_SETUP_CLOSED:"최초 마스터 등록이 이미 완료되었습니다. 등록 상태를 다시 확인해 주세요.",
 SETUP_TRY_LATER:"설정 비밀번호를 여러 번 틀렸습니다. 15분 뒤 다시 시도해 주세요.",SETUP_PASSWORD_INVALID:"설정 비밀번호를 확인해 주세요.",
 MASTER_STORE_NOT_FOUND:"서버에 설정된 상점을 확인할 수 없습니다.",ACCOUNT_OTHER_STORE:"이 계정의 해당 역할은 다른 상점에 연결되어 있습니다. 상점을 자동 변경하지 않습니다.",
 ACCOUNT_NOT_FOUND:"계정을 찾을 수 없습니다. 해당 계정으로 먼저 로그인한 뒤 고유번호를 확인해 주세요.",
 ACCOUNT_DISABLED:"사용 중지된 계정은 승인할 수 없습니다.",ACCOUNT_LOGIN_REQUIRED:"비회원 계정은 승인할 수 없습니다. 구글·카카오·네이버 또는 이메일로 먼저 로그인해 주세요.",
 MASTER_ADMIN_PROTECTED:"마스터 계정의 관리자 권한은 이 화면에서 해제할 수 없습니다.",
 ACCESS_VERSION_CONFLICT:"다른 변경이 먼저 반영되었습니다. 계정 정보를 다시 확인해 주세요.",INVALID_INPUT:"입력한 계정 고유번호와 선택 항목을 확인해 주세요.",
};
type Props={auth:Auth;user:User;apiOrigin:string;disabled?:boolean;onChanged:()=>void;onBusyChange:(busy:boolean)=>void};
export default function StaffAccess({auth,user,apiOrigin,disabled=false,onChanged,onBusyChange}:Props){
 const [status,setStatus]=useState<Status|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[password,setPassword]=useState("");
 const [includeMerchant,setIncludeMerchant]=useState(false),[target,setTarget]=useState(""),[account,setAccount]=useState<Account|null>(null);
 const [role,setRole]=useState<Role>("merchant"),[confirmed,setConfirmed]=useState(false),[revoke,setRevoke]=useState<Member|null>(null);
 const live=useRef(false),working=useRef(false),generation=useRef(0),callbacks=useRef({onChanged,onBusyChange});
 const controllers=useRef(new Set<AbortController>());
 callbacks.current={onChanged,onBusyChange};
 const endpoint=apiOrigin.replace(/\/$/,"")+"/api/admin/access";
 async function request(body?:unknown){
  const seq=generation.current;
  if(!live.current||auth.currentUser?.uid!==user.uid)throw Error("STALE_ACCOUNT");
  const token=await user.getIdToken();
  if(!live.current||seq!==generation.current||auth.currentUser?.uid!==user.uid)throw Error("STALE_ACCOUNT");
  const controller=new AbortController();controllers.current.add(controller);
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
  const response=await fetch(endpoint,{method:body?"POST":"GET",credentials:"omit",cache:"no-store",signal:controller.signal,
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!live.current||seq!==generation.current||auth.currentUser?.uid!==user.uid)throw Error("STALE_ACCOUNT");
  const data=await response.json();
  if(!live.current||seq!==generation.current||auth.currentUser?.uid!==user.uid)throw Error("STALE_ACCOUNT");
  if(!response.ok)throw Error(data.error||"MASTER_UNAVAILABLE");return data;
  }finally{clearTimeout(timeout);controllers.current.delete(controller)}
 }
 async function refresh(){setStatus(await request())}
 useEffect(()=>{
  live.current=true;generation.current++;const seq=generation.current;
  setStatus(null);setPassword("");setAccount(null);setTarget("");setError("");setNotice("");setLoading(true);setBusy(false);
  void refresh().catch(e=>{if(live.current&&seq===generation.current&&e.message!=="STALE_ACCOUNT")setError(messages[e.message]||"계정 승인 정보를 확인하지 못했습니다. 다시 확인해 주세요.")})
   .finally(()=>{if(live.current&&seq===generation.current)setLoading(false)});
  return()=>{live.current=false;generation.current++;for(const c of controllers.current)c.abort();callbacks.current.onBusyChange(false)};
 },[user.uid,endpoint]);
 async function run(action:()=>Promise<void>){
  if(working.current||disabled)return;
  working.current=true;setBusy(true);callbacks.current.onBusyChange(true);setError("");setNotice("");
  try{await action()}catch(e){if(live.current&&(e as Error).message!=="STALE_ACCOUNT")setError(messages[(e as Error).message]||"처리 결과를 확인하지 못했습니다. 등록 상태를 다시 확인해 주세요.")}
  finally{working.current=false;if(live.current){setBusy(false);callbacks.current.onBusyChange(false)}}
 }
 const locked=busy||disabled;
 const member=account?.memberships.find(m=>m.role===role);
 const groupedMembers = Array.from((status?.members || []).reduce((groups, member) => {
  const group = groups.get(member.user_uid) || {uid:member.user_uid,email:member.email,emailStatus:member.emailStatus,roles:[] as Member[]};
  group.roles.push(member); groups.set(member.user_uid,group); return groups;
 },new Map<string,{uid:string;email?:string|null;emailStatus?:string;roles:Member[]}>()).values());
 return <section className="staff-access card" aria-labelledby="staff-access-heading">
  <div className="staff-access-heading"><div><p className="eyebrow">ACCOUNT ACCESS</p><h2 id="staff-access-heading">계정 승인</h2></div>
   <button type="button" disabled={locked||loading} onClick={()=>void run(async()=>{await refresh();setNotice("등록 상태를 확인했습니다.")})}>등록 상태 확인</button></div>
  {loading&&<p role="status">계정 승인 상태를 확인하고 있습니다.</p>}
  {status?.needsRecentLogin&&<p className="notice">{messages.RECENT_LOGIN_REQUIRED}</p>}
  {status?.canSetup&&<form className="access-form" onSubmit={e=>{e.preventDefault();void run(async()=>{
    const value=password;setPassword("");await request({action:"bootstrap",password:value,includeMerchant});
    await refresh();setNotice("마스터 등록을 완료했습니다. 최초 등록은 잠겼으며, 이후에는 구글로 로그인하면 됩니다.");callbacks.current.onChanged();
   })}}>
   <h3>최초 마스터 계정 등록</h3>
   <p>지정된 구글 계정 확인이 완료되었습니다. 처음 한 번만 설정 비밀번호를 입력하세요. 등록 후 이 화면에서 다른 계정을 승인할 수 있습니다.</p>
   <PrivateInput label="최초 설정 비밀번호" autoComplete="off" maxLength={256} value={password} required disabled={locked||status.needsRecentLogin} onChange={e=>setPassword(e.target.value)}/>
   <label className="access-check"><input type="checkbox" checked={includeMerchant} disabled={locked} onChange={e=>setIncludeMerchant(e.target.checked)}/>이 계정으로 판매자 사이트도 이용</label>
   <button className="primary" disabled={locked||status.needsRecentLogin||!password}>마스터 등록</button>
  </form>}
  {status&&!status.canSetup&&!status.isMaster&&<p>계정 승인은 등록된 마스터 구글 계정에서 진행합니다. 승인이 필요한 계정은 위의 내 계정 고유번호를 마스터에게 전달하세요.</p>}
  {status?.isMaster&&<>
   <p>마스터 계정으로 로그인했습니다. 계정을 확인한 뒤 필요한 역할을 승인하세요.</p>
   <form className="access-form" onSubmit={e=>{e.preventDefault();void run(async()=>{
    setAccount(null);setConfirmed(false);const result=await request({action:"lookup",uid:target.trim()});setAccount(result.account);
   })}}>
    <PrivateInput label="승인할 계정 고유번호(UID)" value={target} maxLength={128} required autoComplete="off" disabled={locked||status.needsRecentLogin} onChange={e=>{setTarget(e.target.value);setAccount(null);setConfirmed(false)}}/>
    <button type="submit" disabled={locked||status.needsRecentLogin||!target.trim()}>계정 확인</button>
   </form>
   {account&&<div className="access-review">
    <h3>승인할 계정 확인</h3>
    <dl><dt>계정 고유번호</dt><dd><PrivateValue key={account.uid+":uid"} value={account.uid} label="승인할 계정 고유번호"/></dd><dt>이메일</dt><dd><PrivateValue key={account.uid+":email"} value={account.email} label="승인할 계정 이메일"/></dd>
     <dt>이름</dt><dd>{account.displayName||"제공되지 않음"}</dd></dl>
    <label>승인할 역할<select aria-label="승인할 역할" value={role} disabled={locked} onChange={e=>{setRole(e.target.value as Role);setConfirmed(false)}}><option value="merchant">판매자</option><option value="admin">관리자</option></select></label>
    {member?.otherStore?<p className="notice">{messages.ACCOUNT_OTHER_STORE}</p>:member?.active?<p>이 역할은 이미 승인되어 있습니다.</p>:<>
     <label className="access-check"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e=>setConfirmed(e.target.checked)}/>이 계정의 소유자를 확인했으며 {roleName(role)} 권한 부여에 동의합니다.</label>
     <button className="primary" type="button" disabled={locked||status.needsRecentLogin||!confirmed} onClick={()=>void run(async()=>{
      await request({action:"set",uid:account.uid,role,active:true,expectedActive:member?member.active:null});
      setAccount(null);setTarget("");setConfirmed(false);await refresh();setNotice(roleName(role)+" 권한을 승인했습니다.");callbacks.current.onChanged();
     })}>{roleName(role)}로 승인</button>
    </>}
   </div>}
   <div className="access-list-heading"><h3>등록된 계정 <small>{groupedMembers.length}개</small></h3><p>계정별로 판매자·관리자 권한을 함께 확인하세요. 최대 100개 권한 기준입니다.</p></div>
   <ul className="access-members">{groupedMembers.map((group,index)=><li key={group.uid}>
    <div className="access-account-heading"><strong>등록 계정 {String(index+1).padStart(2,"0")}</strong>{group.uid===status.masterUid&&<span className="access-master-badge">마스터 계정</span>}</div>
    <div className="access-member-fields">
     <div className="access-member-field"><small>이메일</small><PrivateValue value={group.email} label={`계정 ${index+1} 이메일`} emptyText={group.emailStatus==="unavailable"?"조회하지 못함":group.emailStatus==="not_found"?"계정 없음":"제공되지 않음"}/></div>
     <div className="access-member-field"><small>고유번호</small><PrivateValue value={group.uid} label={`계정 ${index+1} 고유번호`}/></div>
    </div>
    <div className="access-role-list">{group.roles.map(m=><div key={m.role} className="access-role-item">
     <b>{roleName(m.role)}</b><span>{m.active?"승인됨":"해제됨"}</span>
     {group.uid===status.masterUid&&m.role==="admin"?<span>마스터 보호</span>:!!m.active&&<button type="button" disabled={locked||status.needsRecentLogin} aria-label={`계정 ${index+1} ${roleName(m.role)} 권한 해제`} onClick={()=>setRevoke(m)}>권한 해제</button>}
    </div>)}</div>
   </li>)}</ul>
   {revoke&&<div className="access-review" role="group" aria-label="권한 해제 확인">
    <p>아래 계정의 {roleName(revoke.role)} 권한을 해제합니다. 해당 역할의 다음 자료 조회부터 접근이 차단됩니다.</p>
    <PrivateValue value={revoke.user_uid} label="해제할 계정 고유번호"/>
    <button type="button" disabled={locked||status.needsRecentLogin} onClick={()=>void run(async()=>{
     await request({action:"set",uid:revoke.user_uid,role:revoke.role,active:false,expectedActive:!!revoke.active});
     setRevoke(null);setAccount(null);await refresh();setNotice("권한을 해제했습니다.");callbacks.current.onChanged();
    })}>해제 확인</button><button type="button" disabled={locked} onClick={()=>setRevoke(null)}>취소</button>
   </div>}
   <h3>최근 승인·해제 이력</h3><ul className="access-history">{status.history?.length?status.history.map(h=><li key={h.id}>
    <PrivateValue value={h.target_uid} label={`변경 이력 ${h.id} 계정 고유번호`}/><b>{roleName(h.role)} · {h.after_active?"승인":"해제"}</b><small>{accessDate(h.created_at)} (한국 시간)</small>
   </li>):<li>아직 변경 이력이 없습니다.</li>}</ul>
  </>}
  {error&&<p role="alert" className="social-error">{error}</p>}{notice&&<p role="status" className="access-notice">{notice}</p>}
 </section>;
}
