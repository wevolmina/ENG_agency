// Auth, provider popups and business APIs are fixtures. No live sign-in, order or DB writes.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||"playwright");
const customer=process.env.UI_BASE_URL||"http://127.0.0.1:5188";
const admin=process.env.ADMIN_BASE_URL||"http://127.0.0.1:5190";
const seller=process.env.STAFF_BASE_URL||"http://127.0.0.1:3000";
const out=process.env.UI_EVIDENCE_DIR||".qa/social-login";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS"};
const products=[{id:"bedroom-lighting",name:"편안한 밤 조명 패키지",price:99000,active:true},
 {id:"kitchen-sensing",name:"주방 센서 조명 패키지",price:99000,active:true},
 {id:"desk-focus",name:"데스크테리어 집중 패키지",price:79000,active:true}];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?
  {executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:JSON.parse(process.env.BROWSER_ARGS_JSON||"[]")}:
  {channel:process.env.PLAYWRIGHT_CHANNEL||"msedge"})});
 const errors=[],results={method:"Local apps with intercepted provider/Auth/business data; no production writes"};
 try{
  async function context({ready=true,blocked=false,guestOrder=false,merchantAllowed=false}={}){
   const ctx=await browser.newContext();
   const calls=[];
   if(blocked)await ctx.addInitScript(()=>{window.open=()=>null});
   await ctx.route("**/api/auth/social/config",r=>r.fulfill({headers:cors,json:{google:ready,kakao:ready,naver:ready}}));
   await ctx.route("**/api/catalog",r=>r.fulfill({headers:cors,json:{packages:products}}));
   await ctx.route("**/identitytoolkit.googleapis.com/**",async r=>{
    const url=r.request().url();
    if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:cors});
    const body=r.request().postDataJSON()||{};
    const uid=guestOrder?"guest-fixture":"social-fixture",now=Math.floor(Date.now()/1000);
    const token=Buffer.from("{}").toString("base64url")+"."+Buffer.from(JSON.stringify({sub:uid,user_id:uid,
      exp:now+3600,iat:now,auth_time:now,firebase:{sign_in_provider:guestOrder?"anonymous":"custom"}})).toString("base64url")+".fixture";
    if(url.includes("signInWithCustomToken"))calls.push(body);
    return r.fulfill({headers:cors,json:url.includes("accounts:lookup")?{users:[{localId:uid,
      createdAt:String(Date.now()),lastLoginAt:String(Date.now()),providerUserInfo:[]}]}:
      {idToken:token,refreshToken:"fixture-refresh",expiresIn:"3600",localId:uid,isNewUser:true}});
   });
   await ctx.route("**/api/auth/social/start?*",r=>{
    const u=new URL(r.request().url()),nonce=u.searchParams.get("nonce"),origin=u.searchParams.get("origin");
    const data={type:"paybridge-social-login",nonce,token:"header.payload.signature"};
    return r.fulfill({contentType:"text/html",body:'<!doctype html><meta charset="utf-8"><button id="send">로그인 결과 전달</button>'+
     '<script>window.opener.postMessage('+JSON.stringify({...data,nonce:"wrong-nonce"})+','+JSON.stringify(origin)+');'+
     'document.getElementById("send").onclick=()=>window.opener.postMessage('+JSON.stringify(data)+','+JSON.stringify(origin)+');</script>'});
   });
   await ctx.route("**/api/admin/overview",r=>r.fulfill({headers:cors,status:403,json:{error:"ADMIN_ACCESS_REQUIRED"}}));
   await ctx.route("**/api/payments",r=>{
    assert.match(r.request().headers().authorization||"",/^Bearer /,"merchant reads require Firebase ID token");
    return r.fulfill({headers:cors,status:merchantAllowed?200:403,json:merchantAllowed?
      {merchantId:"fixture-store",totals:{count:0,revenue:0,average:0},payments:[],asOf:new Date().toISOString()}:
      {error:"MERCHANT_ACCESS_REQUIRED"}});
   });
   await ctx.route("**/api/cart-checkout",r=>{
    if(!guestOrder)throw Error("Unexpected order write in login test");
    if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:cors});
    return r.fulfill({headers:cors,json:{productId:"bedroom-lighting",paymentId:"fixture-guest-payment",
     orderId:"fixture-guest-order",productName:products[0].name,quantity:1,amount:99000,
     status:"MOCK_APPROVED",createdAt:new Date().toISOString(),items:[]}});
   });
   const page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));
   return {ctx,page,calls};
  }
  let {ctx,page,calls}=await context();
  await page.goto(customer);
  await page.getByRole("button",{name:"카카오로 계속하기",exact:true}).waitFor();
  await page.getByLabel("침실 패키지 선택",{exact:true}).check();
  await page.locator(".mock-consent input").check();
  const popupPromise=page.waitForEvent("popup");
  await page.getByRole("button",{name:"카카오로 계속하기",exact:true}).click();
  const popup=await popupPromise;await popup.locator("#send").waitFor();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(calls.length,0,"wrong nonce must not exchange Firebase token");
  assert.equal(await page.locator(".mock-consent input").isEnabled(),false,"checkout locked during popup");
  await popup.locator("#send").click();
  await page.getByRole("heading",{name:"내 계정",exact:true}).waitFor();
  assert.equal(calls.length,1);assert.equal(calls[0].token,"header.payload.signature");
  assert.equal(await page.locator(".mock-consent input").isChecked(),false,"account switch resets consent");
  assert.equal(await page.getByRole("button",{name:"로그아웃",exact:true}).isEnabled(),true,"login busy resets after success");
  await page.getByRole("button",{name:"로그아웃",exact:true}).click();
  await page.getByRole("heading",{name:"간편하게 로그인하고 둘러보세요",exact:true}).waitFor();
  results.customerLoginLogoutAndConsent=true;results.wrongNonceIgnored=true;results.checkoutLockedDuringLogin=true;
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"overflow "+width);
  }
  fs.mkdirSync(out,{recursive:true});
  if(process.env.QA_FONT_CSS)await page.addStyleTag({content:fs.readFileSync(process.env.QA_FONT_CSS,"utf8")+'\nbody{font-family:"Noto Sans KR",sans-serif!important}'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:out+"/customer-social.png",fullPage:false});
  await ctx.close();

  ({ctx,page,calls}=await context());
  await page.goto(admin);
  const managerPopup=page.waitForEvent("popup");
  await page.getByRole("button",{name:"네이버로 계속하기",exact:true}).click();
  const naver=await managerPopup;await naver.locator("#send").click();
  await page.getByText("관리자 권한이 없습니다. 승인된 계정으로 로그인해 주세요.",{exact:true}).waitFor();
  assert.equal(await page.locator(".admin-package-grid").count(),0);
  await page.getByRole("button",{name:"로그아웃",exact:true}).click();
  await page.getByRole("button",{name:"로그인",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"로그인",exact:true}).isEnabled(),true);
  assert.equal(await page.getByRole("button",{name:"구글로 계속하기",exact:true}).isEnabled(),true);
  results.adminSocialLoginStillDeniedWithoutMembership=true;results.emailFallbackAfterLogout=true;
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"admin overflow "+width)}
  await page.setViewportSize({width:390,height:844});
  if(process.env.QA_FONT_CSS)await page.addStyleTag({content:fs.readFileSync(process.env.QA_FONT_CSS,"utf8")+'\nbody{font-family:"Noto Sans KR",sans-serif!important}'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:out+"/admin-social-mobile.png",fullPage:true});
  await ctx.close();

  for(const [provider,merchantAllowed] of [["카카오",false],["네이버",true]]){
   ({ctx,page,calls}=await context({merchantAllowed}));
   await page.goto(seller);
   await page.getByRole("heading",{name:"판매자 센터 로그인",exact:true}).waitFor();
   const sellerPopup=page.waitForEvent("popup");
   await page.getByRole("button",{name:provider+"로 계속하기",exact:true}).click();
   const loginPopup=await sellerPopup;await loginPopup.locator("#send").waitFor();
   assert.equal(await page.getByRole("textbox",{name:"이메일",exact:true}).isEnabled(),false);
   assert.equal(calls.length,0,"wrong popup nonce cannot sign in a seller");
   await loginPopup.locator("#send").click();
   if(merchantAllowed){
    await page.getByText("마지막으로 확인한 모의 거래",{exact:true}).waitFor();
    assert.match(await page.locator(".metrics").innerText(),/누적 모의 매출/);
   }else{
    await page.getByText("판매자 권한이 없습니다. 승인된 계정으로 로그인해 주세요.",{exact:true}).waitFor();
    assert.equal(await page.locator("#transactions .approved").count(),0);
    assert(!/99,000/.test(await page.locator(".metrics").innerText()));
   }
   assert.equal(calls.length,1);
   assert.equal(await page.locator(".admin-package-grid").count(),0);
   await page.getByRole("button",{name:"로그아웃",exact:true}).click();
   await page.getByRole("heading",{name:"판매자 센터 로그인",exact:true}).waitFor();
   assert.equal(await page.getByRole("button",{name:"로그인",exact:true}).isEnabled(),true);
   assert.equal(await page.getByRole("button",{name:"구글로 계속하기",exact:true}).isEnabled(),true);
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"seller overflow "+width)}
   await page.setViewportSize({width:1440,height:960});
   if(process.env.QA_FONT_CSS)await page.addStyleTag({content:fs.readFileSync(process.env.QA_FONT_CSS,"utf8")+'\nbody{font-family:"Noto Sans KR",sans-serif!important}'});
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:out+"/seller-social-"+merchantAllowed+".png",fullPage:true});
   await ctx.close();
  }
  results.sellerSocialLoginDeniedWithoutMembership=true;
  results.sellerSocialLoginWithMembership=true;results.sellerEmailFallbackAndLayout=true;

  ({ctx,page}=await context({guestOrder:true}));
  await page.goto(customer);
  await page.getByLabel("침실 패키지 선택",{exact:true}).check();
  await page.locator(".mock-consent input").check();
  await page.getByRole("button",{name:"바로 구매 · 모의 결제",exact:true}).click();
  await page.locator(".completion").waitFor();
  assert.equal(await page.getByRole("button",{name:"구글로 계속하기",exact:true}).isEnabled(),true);
  assert.equal(await page.getByRole("button",{name:/카카오로 계속하기/}).isEnabled(),false);
  assert.equal(await page.getByRole("button",{name:/네이버로 계속하기/}).isEnabled(),false);
  await page.getByRole("button",{name:"스토어로 돌아가기",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:/카카오로 계속하기/}).isEnabled(),false,
   "previous anonymous history remains protected after returning to store");
  results.anonymousOrderHistoryProtected=true;await ctx.close();

  ({ctx,page}=await context({ready:false}));
  await page.goto(customer);
  await page.getByRole("button",{name:/카카오로 계속하기/}).waitFor();
  assert.equal(await page.getByRole("button",{name:/카카오로 계속하기/}).isEnabled(),false);
  assert.equal(await page.getByRole("button",{name:/구글로 계속하기/}).isEnabled(),false);
  results.unconfiguredProvidersDisabled=true;await ctx.close();

  ({ctx,page}=await context({blocked:true}));
  await page.goto(customer);await page.getByRole("button",{name:"카카오로 계속하기",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"팝업을 허용"}).waitFor();
  assert.equal(await page.getByRole("button",{name:"네이버로 계속하기",exact:true}).isEnabled(),true);
  results.blockedPopupRecovery=true;await ctx.close();
  assert.deepEqual(errors,[]);results.pageErrors=errors;results.widths=[320,390,768,1440];
  fs.writeFileSync(out+"/verification.json",JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
