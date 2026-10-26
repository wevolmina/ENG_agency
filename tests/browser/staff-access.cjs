// Isolated Auth/API fixtures. Never creates real accounts or changes production permissions.
const assert=require("node:assert/strict"),fs=require("node:fs");
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS"};
async function run(options={}){
 const {chromium}=require(options.playwrightModulePath||process.env.PLAYWRIGHT_MODULE_PATH||"playwright");
 const base=options.baseUrl||process.env.ADMIN_BASE_URL||"http://127.0.0.1:5190",out=options.evidenceDir||process.env.UI_EVIDENCE_DIR||".qa/staff-requests";
 const browser=await chromium.launch({headless:true,...((options.browserExecutablePath||process.env.BROWSER_EXECUTABLE_PATH)?{executablePath:options.browserExecutablePath||process.env.BROWSER_EXECUTABLE_PATH}:{channel:"msedge"})});
 const errors=[],members=[],requests=[],history=[],requestHistory=[],writes=[];let complete=false,nextId=0;
 async function context(uid,eligible){
  const ctx=await browser.newContext();
  await ctx.route("**/api/auth/social/config",r=>r.fulfill({headers:cors,json:{google:true,kakao:false,naver:false}}));
  await ctx.route("**/identitytoolkit.googleapis.com/**",r=>{
   if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:cors});
   const now=Math.floor(Date.now()/1000),email=uid+"@example.invalid",jwt=Buffer.from("{}").toString("base64url")+"."+Buffer.from(JSON.stringify({sub:uid,user_id:uid,exp:now+3600,iat:now,auth_time:now,email,email_verified:true,firebase:{sign_in_provider:"google.com"}})).toString("base64url")+".fixture";
   return r.fulfill({headers:cors,json:r.request().url().includes("accounts:lookup")?{users:[{localId:uid,email,emailVerified:true,createdAt:String(Date.now()),lastLoginAt:String(Date.now()),providerUserInfo:[{providerId:"google.com",rawId:uid}]}]}:{idToken:jwt,refreshToken:"fixture-refresh",expiresIn:"3600",localId:uid,email,registered:true}});
  });
  await ctx.route("**/api/admin/overview",r=>r.fulfill({headers:cors,status:members.some(m=>m.user_uid===uid&&m.role==="admin"&&m.active)?200:403,json:{merchantId:"fixture-shop",totals:{count:0,revenue:0,average:0},payments:[],asOf:new Date().toISOString(),packages:[],roles:[],audit:[]}}));
  await ctx.route("**/api/staff/requests",r=>{
   const req=r.request();if(req.method()==="OPTIONS")return r.fulfill({headers:cors,status:204});
   if(req.method()==="POST"){
    const body=req.postDataJSON();assert.deepEqual(Object.keys(body),["role"]);writes.push(body);
    const old=requests.findIndex(a=>a.user_uid===uid&&a.role===body.role);if(old>=0)requests.splice(old,1);
    requests.push({request_id:"fixture-request-"+(++nextId),user_uid:uid,role:body.role,email:uid+"@example.invalid",display_name:"새 신청자",status:"pending",reason:"",created_at:"2026-10-26 09:00:00"});
    return r.fulfill({headers:cors,json:{ok:true}});
   }
   return r.fulfill({headers:cors,json:{ready:complete,requests:requests.filter(a=>a.user_uid===uid),memberships:members.filter(m=>m.user_uid===uid).map(m=>({role:m.role,active:m.active,otherStore:false}))}});
  });
  await ctx.route("**/api/admin/access",r=>{
   const req=r.request();if(req.method()==="OPTIONS")return r.fulfill({headers:cors,status:204});
   const master=complete&&uid==="owner-fixture";
   if(req.method()==="GET")return r.fulfill({headers:cors,json:{isMaster:master,canSetup:eligible&&!complete,needsRecentLogin:false,...(master?{masterUid:uid,members,history,requestHistory,requests:requests.filter(a=>a.status==="pending")}:{})}});
   const body=req.postDataJSON();writes.push(body);
   if(body.action==="bootstrap"){
    if(body.password!=="fixture-setup-password")return r.fulfill({headers:cors,status:403,json:{error:"SETUP_PASSWORD_INVALID"}});
    complete=true;members.push({user_uid:uid,role:"admin",active:true,email:uid+"@example.invalid"},{user_uid:uid,role:"merchant",active:true,email:uid+"@example.invalid"});
   }else if(body.action==="review"){
    assert(master);assert.equal(body.uid,undefined);const a=requests.find(a=>a.request_id===body.requestId);assert(a&&a.status==="pending");a.status=body.decision;a.reason=body.reason;
    requestHistory.unshift({id:requestHistory.length+1,user_uid:a.user_uid,role:a.role,decision:body.decision,reason:body.reason,created_at:a.created_at});
    if(body.decision==="approved"){members.push({user_uid:a.user_uid,role:a.role,active:true,email:a.email});history.unshift({id:history.length+1,target_uid:a.user_uid,role:a.role,after_active:true,created_at:a.created_at})}
   }else if(body.action==="set"){
    assert(master);assert.equal(body.active,false);const m=members.find(m=>m.user_uid===body.uid&&m.role===body.role);assert(m&&m.active);m.active=false;
   }else throw Error("Unexpected fixture action");
   return r.fulfill({headers:cors,json:{ok:true}});
  });
  const page=await ctx.newPage();page.setDefaultTimeout(8000);page.on("pageerror",e=>errors.push(e.message));await page.goto(base);
  await page.getByRole("textbox",{name:"이메일",exact:true}).fill(uid+"@example.invalid");await page.getByLabel("비밀번호",{exact:true}).fill("fixture-login-password");await page.getByRole("button",{name:"로그인",exact:true}).click();
  await page.locator('nav a[href="#accounts"]').click();return {ctx,page};
 }
 try{
  const owner=await context("owner-fixture",true),master=owner.page;
  await master.getByLabel("최초 설정 비밀번호",{exact:true}).fill("wrong-fixture");await master.getByRole("button",{name:"마스터 등록",exact:true}).click();await master.getByRole("alert").filter({hasText:"설정 비밀번호를 확인"}).waitFor();assert.equal(await master.getByLabel("최초 설정 비밀번호",{exact:true}).inputValue(),"");
  await master.getByLabel("최초 설정 비밀번호",{exact:true}).fill("fixture-setup-password");await master.getByLabel("이 계정으로 판매자 사이트도 이용").check();await master.getByRole("button",{name:"마스터 등록",exact:true}).click();await master.getByText("대기 중인 신청이 없습니다.").waitFor();
  assert.equal(await master.getByLabel("승인할 계정 고유번호(UID)").count(),0);assert.equal(await master.getByRole("button",{name:"계정 1 관리자 권한 해제",exact:true}).count(),0);
  const person=await context("new-person",false),applicant=person.page;
  await applicant.getByLabel("신청 역할",{exact:true}).selectOption("merchant");await applicant.getByRole("button",{name:"판매자 권한 신청",exact:true}).click();await applicant.getByText(/판매자 신청을 검토 중입니다/).waitFor();assert.equal(members.some(m=>m.user_uid==="new-person"),false);
  await master.getByRole("button",{name:"등록 상태 확인",exact:true}).click();await master.getByRole("button",{name:"신청 1 판매자 수락",exact:true}).click();await master.getByText("판매자 신청을 수락했습니다.",{exact:true}).waitFor();
  await applicant.getByRole("button",{name:"신청 상태 확인",exact:true}).click();await applicant.getByText("판매자 권한이 승인되어 있습니다.",{exact:true}).waitFor();assert.equal(members.some(m=>m.user_uid==="new-person"&&m.role==="admin"),false);
  await applicant.getByLabel("신청 역할",{exact:true}).selectOption("admin");await applicant.getByRole("button",{name:"관리자 권한 신청",exact:true}).click();await applicant.getByText(/관리자 신청을 검토 중입니다/).waitFor();
  await master.getByRole("button",{name:"등록 상태 확인",exact:true}).click();await master.getByLabel("거절 사유 (선택)").fill("신청 정보 확인 필요");await master.getByRole("button",{name:"신청 1 관리자 거절",exact:true}).click();await master.getByText("관리자 신청을 거절했습니다.",{exact:true}).waitFor();
  await applicant.getByRole("button",{name:"신청 상태 확인",exact:true}).click();await applicant.getByText(/관리자 신청이 거절되었습니다.*신청 정보 확인 필요/).waitFor();await applicant.getByRole("button",{name:"다시 신청",exact:true}).click();await applicant.getByText(/관리자 신청을 검토 중입니다/).waitFor();assert.equal(requestHistory.length,2);
  assert.equal(await applicant.getByRole("button",{name:/신청 1.*수락/}).count(),0);assert.equal(await applicant.getByRole("heading",{name:"계정 승인",exact:true}).count(),0);
  await master.getByRole("button",{name:"등록 상태 확인",exact:true}).click();await master.getByRole("button",{name:"계정 2 판매자 권한 해제",exact:true}).click();await master.getByRole("button",{name:"해제 확인",exact:true}).click();await master.getByText("권한을 해제했습니다.",{exact:true}).waitFor();
  assert(!/new-person@example.invalid|owner-fixture@example.invalid/.test(await master.locator(".staff-access").innerText()));
  fs.mkdirSync(out,{recursive:true});for(const width of [320,390,768,1440]){await master.setViewportSize({width,height:960});assert.equal(await master.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"master overflow "+width);await applicant.setViewportSize({width,height:960});assert.equal(await applicant.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"applicant overflow "+width)}
  await master.screenshot({path:out+"/master-desktop.png",fullPage:true});await applicant.screenshot({path:out+"/applicant-desktop.png",fullPage:true});await master.setViewportSize({width:390,height:844});await master.screenshot({path:out+"/master-mobile.png",fullPage:true});
  assert.deepEqual(errors,[]);const result={method:"Isolated Auth/API fixtures; no real accounts or role writes",requestWithoutUid:true,pendingCannotAccess:true,acceptOnlyRequestedRole:true,rejectWithReason:true,reapply:true,masterOnly:true,revoke:true,maskedIdentity:true,widths:[320,390,768,1440],pageErrors:errors};fs.writeFileSync(out+"/verification.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result));await owner.ctx.close();await person.ctx.close();
 }finally{await browser.close()}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
