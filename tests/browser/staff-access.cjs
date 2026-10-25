// Isolated Auth/API fixtures only. Never enrolls real accounts, changes production roles or uses real setup secrets.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||"playwright");
const admin=process.env.ADMIN_BASE_URL||"http://127.0.0.1:5190",out=process.env.UI_EVIDENCE_DIR||".qa/master-access";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS"};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?
  {executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:JSON.parse(process.env.BROWSER_ARGS_JSON||"[]")}:{channel:process.env.PLAYWRIGHT_CHANNEL||"msedge"})});
 const errors=[],checks={method:"Isolated Auth/API fixtures; no real setup password or production role writes"};
 async function context({eligible=true,stale=false}={}){
  const ctx=await browser.newContext(),uid="owner-fixture",members=[],history=[],writes=[];let complete=false;
  await ctx.route("**/api/auth/social/config",r=>r.fulfill({headers:cors,json:{google:true,kakao:false,naver:false}}));
  await ctx.route("**/identitytoolkit.googleapis.com/**",r=>{
   if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:cors});
   const now=Math.floor(Date.now()/1000),jwt=Buffer.from("{}").toString("base64url")+"."+Buffer.from(JSON.stringify({
    sub:uid,user_id:uid,exp:now+3600,iat:now,auth_time:now,email:"owner@example.invalid",email_verified:true,firebase:{sign_in_provider:"google.com"}})).toString("base64url")+".fixture";
   return r.fulfill({headers:cors,json:r.request().url().includes("accounts:lookup")?{users:[{localId:uid,email:"owner@example.invalid",emailVerified:true,
    createdAt:String(Date.now()),lastLoginAt:String(Date.now()),providerUserInfo:[{providerId:"google.com",rawId:"fixture"}]}]}:
    {idToken:jwt,refreshToken:"fixture-refresh",expiresIn:"3600",localId:uid,email:"owner@example.invalid",registered:true}});
  });
  await ctx.route("**/api/admin/overview",r=>r.fulfill({headers:cors,status:complete?200:403,json:complete?
    {merchantId:"fixture-shop",totals:{count:0,revenue:0,average:0},payments:[],asOf:new Date().toISOString(),packages:[],roles:[],audit:[]}:{error:"ADMIN_ACCESS_REQUIRED"}}));
  await ctx.route("**/api/admin/access",r=>{
   const req=r.request();if(req.method()==="OPTIONS")return r.fulfill({headers:cors,status:204});
   assert.match(req.headers().authorization||"",/^Bearer /);
   if(req.method()==="GET")return r.fulfill({headers:cors,json:{isMaster:complete,canSetup:eligible&&!complete,needsRecentLogin:stale,
    ...(complete?{masterUid:uid,merchantId:"fixture-shop",members:members.map(m=>({...m,email:m.user_uid===uid?"owner@example.invalid":"seller@example.invalid",emailStatus:"available"})),history}:{})}});
   const body=req.postDataJSON();writes.push(body);
   if(body.action==="bootstrap"){
    if(body.password!=="fixture-setup-password")return r.fulfill({headers:cors,status:403,json:{error:"SETUP_PASSWORD_INVALID"}});
    assert.equal(body.includeMerchant,true);complete=true;members.push({user_uid:uid,role:"admin",active:true},{user_uid:uid,role:"merchant",active:true});
   }else if(body.action==="lookup"){
    return r.fulfill({headers:cors,json:{account:{uid:body.uid,email:"seller@example.invalid",displayName:"시험 판매자",providers:["google.com"],
     memberships:members.filter(m=>m.user_uid===body.uid).map(m=>({role:m.role,active:m.active,otherStore:false}))}}});
   }else if(body.action==="set"){
    assert.equal(body.uid,"seller-fixture");assert.equal(body.role,"merchant");
    let m=members.find(m=>m.user_uid===body.uid&&m.role===body.role);
    assert.equal(m?m.active:null,body.expectedActive);
    if(m)m.active=body.active;else members.push({user_uid:body.uid,role:body.role,active:body.active});
    history.unshift({id:history.length+1,target_uid:body.uid,role:body.role,before_active:body.expectedActive,after_active:body.active,created_at:"2026-10-25 07:00:00"});
   }else throw Error("Unexpected fixture action");
   return r.fulfill({headers:cors,json:{ok:true}});
  });
  const page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto(admin);
  await page.getByRole("textbox",{name:"이메일",exact:true}).fill("owner@example.invalid");
  await page.getByLabel("비밀번호",{exact:true}).fill("fixture-login-password");await page.getByRole("button",{name:"로그인",exact:true}).click();
  await page.locator(".staff-account-id").waitFor();
  return {ctx,page,writes};
 }
 try{
  let {ctx,page,writes}=await context();
  assert(!await page.locator(".staff-account-id").innerText().then(s=>s.includes("owner-fixture")));
  await page.getByRole("button",{name:"내 계정 고유번호 표시",exact:true}).click();
  assert.match(await page.locator(".staff-account-id").innerText(),/owner-fixture/);
  await page.getByRole("button",{name:"내 계정 고유번호 숨기기",exact:true}).click();
  await page.getByRole("heading",{name:"최초 마스터 계정 등록",exact:true}).waitFor();
  await page.getByLabel("최초 설정 비밀번호",{exact:true}).fill("wrong-fixture");
  assert.equal(await page.getByLabel("최초 설정 비밀번호",{exact:true}).getAttribute("type"),"password");
  await page.getByRole("button",{name:"최초 설정 비밀번호 표시",exact:true}).click();
  assert.equal(await page.getByLabel("최초 설정 비밀번호",{exact:true}).getAttribute("type"),"text");
  await page.getByRole("button",{name:"마스터 등록",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"설정 비밀번호를 확인"}).waitFor();
  assert.equal(await page.getByLabel("최초 설정 비밀번호",{exact:true}).inputValue(),"");
  assert.equal(await page.getByLabel("최초 설정 비밀번호",{exact:true}).getAttribute("type"),"password","clearing password also resets visibility");
  await page.getByLabel("최초 설정 비밀번호",{exact:true}).fill("fixture-setup-password");
  await page.getByLabel("이 계정으로 판매자 사이트도 이용",{exact:true}).check();
  await page.getByRole("button",{name:"마스터 등록",exact:true}).click();
  await page.getByText("마스터 등록을 완료했습니다. 최초 등록은 잠겼으며, 이후에는 구글로 로그인하면 됩니다.",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("최초 설정 비밀번호",{exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:"계정 1 관리자 권한 해제",exact:true}).count(),0);
  assert(!/owner-fixture|owner@example.invalid/.test(await page.locator(".access-members").innerText()));
  await page.getByRole("button",{name:"계정 1 이메일 표시",exact:true}).click();
  assert.match(await page.locator(".access-members").innerText(),/owner@example.invalid/);
  assert.equal(await page.getByRole("button",{name:"계정 2 이메일 표시",exact:true}).getAttribute("aria-pressed"),"false");
  await page.getByRole("button",{name:"계정 1 이메일 숨기기",exact:true}).click();
  await page.getByText("마지막으로 확인한 모의 거래",{exact:true}).waitFor();
  const target=page.getByLabel("승인할 계정 고유번호(UID)",{exact:true});
  await target.fill("seller-fixture");await page.getByRole("button",{name:"계정 확인",exact:true}).click();
  await page.getByRole("heading",{name:"승인할 계정 확인",exact:true}).waitFor();
  assert(!/seller-fixture|seller@example.invalid/.test(await page.locator(".access-review").innerText()));
  await page.getByRole("button",{name:"승인할 계정 이메일 표시",exact:true}).click();
  assert.match(await page.locator(".access-review").innerText(),/seller@example.invalid/);
  assert.equal(await page.getByRole("button",{name:"판매자로 승인",exact:true}).isEnabled(),false);
  const confirm=page.getByRole("checkbox",{name:/이 계정의 소유자를 확인/});await confirm.check();
  await page.getByLabel("승인할 역할",{exact:true}).selectOption("admin");
  assert.equal(await confirm.isChecked(),false,"changing role resets confirmation");
  await page.getByLabel("승인할 역할",{exact:true}).selectOption("merchant");await confirm.check();
  await target.fill("changed-fixture");assert.equal(await page.getByRole("heading",{name:"승인할 계정 확인",exact:true}).count(),0);
  await target.fill("seller-fixture");await page.getByRole("button",{name:"계정 확인",exact:true}).click();await confirm.check();
  await page.getByRole("button",{name:"판매자로 승인",exact:true}).click();await page.getByText("판매자 권한을 승인했습니다.",{exact:true}).waitFor();
  assert(!/seller-fixture|seller@example.invalid/.test(await page.locator(".access-members").innerText()));
  await page.getByRole("button",{name:"계정 3 판매자 권한 해제",exact:true}).click();
  await page.getByRole("group",{name:"권한 해제 확인",exact:true}).waitFor();
  await page.getByRole("button",{name:"해제 확인",exact:true}).click();await page.getByText("권한을 해제했습니다.",{exact:true}).waitFor();
  assert.equal(writes.filter(x=>x.action==="bootstrap").length,2);assert.deepEqual(writes.filter(x=>x.action==="set").map(x=>x.active),[true,false]);
  assert.equal(writes.some(x=>"email" in x||"merchantId" in x),false,"client cannot choose owner email or shop");
  checks.setupPasswordCleared=true;checks.setupLocksAfterSuccess=true;checks.sellerOptIn=true;checks.rootAdminProtected=true;
  checks.targetAndRoleChangeResetReview=true;checks.approveRevokeAndAudit=true;
  checks.emailsAndUidsMaskedByDefault=true;checks.independentEyeToggles=true;checks.passwordToggleResetsWhenCleared=true;
  assert(!/seller-fixture/.test(await page.locator(".access-history").innerText()));
  assert(!/owner-fixture|seller-fixture|owner@example.invalid|seller@example.invalid/.test(await page.locator(".staff-access [aria-label],.staff-access [title]").evaluateAll(nodes=>nodes.map(n=>(n.getAttribute("aria-label")||"")+" "+(n.getAttribute("title")||"")).join(" "))),"masked identity must not leak in accessible labels or tooltips");
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"access overflow "+width)}
  fs.mkdirSync(out,{recursive:true});await page.setViewportSize({width:1440,height:960});
  if(process.env.QA_FONT_CSS)await page.addStyleTag({content:fs.readFileSync(process.env.QA_FONT_CSS,"utf8")+'\nbody{font-family:"Noto Sans KR",sans-serif!important}'});
  await page.evaluate(()=>document.fonts.ready);await page.locator(".staff-access").screenshot({path:out+"/staff-access-desktop.png"});
  await page.setViewportSize({width:390,height:844});await page.locator(".staff-access").screenshot({path:out+"/staff-access-mobile.png"});await ctx.close();
  ({ctx,page,writes}=await context({stale:true}));await page.getByRole("heading",{name:"최초 마스터 계정 등록",exact:true}).waitFor();
  assert.equal(await page.getByLabel("최초 설정 비밀번호",{exact:true}).isEnabled(),false);
  assert.equal(await page.getByRole("button",{name:"마스터 등록",exact:true}).isEnabled(),false);
  assert.equal(writes.length,0);checks.staleLoginCannotWrite=true;await ctx.close();
  ({ctx,page}=await context({eligible:false}));await page.getByText(/계정 승인은 등록된 마스터 구글 계정/).waitFor();
  assert.equal(await page.getByRole("heading",{name:"최초 마스터 계정 등록",exact:true}).count(),0);
  assert.equal(await page.getByLabel("승인할 계정 고유번호(UID)",{exact:true}).count(),0);checks.ordinaryAccountCannotManage=true;await ctx.close();
  assert.deepEqual(errors,[]);checks.pageErrors=errors;checks.widths=[320,390,768,1440];
  fs.writeFileSync(out+"/staff-access-verification.json",JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
