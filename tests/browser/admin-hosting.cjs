// Local origins represent Vercel and Cloudflare. Auth/data are fixtures; no production writes.
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const merchant = process.env.STAFF_BASE_URL || "http://127.0.0.1:3000",
  admin = process.env.ADMIN_BASE_URL || "http://127.0.0.1:5190";
(async () => {
  const preflight = await fetch(merchant + "/api/admin/overview", {
    method: "OPTIONS",
    headers: {
      Origin: admin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), admin);
  const unauth = await fetch(merchant + "/api/admin/overview", {
    headers: { Origin: admin },
  });
  assert.equal(unauth.status, 403);
  assert.equal((await unauth.json()).error, "ADMIN_ACCESS_REQUIRED");
  const bad = await fetch(merchant + "/api/admin/overview", {
    headers: { Origin: "https://unexpected.example.test" },
  });
  assert.equal(bad.status, 403);
  assert.equal((await bad.json()).error, "ADMIN_ORIGIN_NOT_ALLOWED");
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const legacy = await fetch(merchant + "/admin", { redirect: "manual" });
  assert.equal(legacy.status, 307);
  assert.equal(legacy.headers.get("location"), admin + "/");
  const options = process.env.BROWSER_EXECUTABLE_PATH
    ? {
        executablePath: process.env.BROWSER_EXECUTABLE_PATH,
        args: JSON.parse(process.env.BROWSER_ARGS_JSON || "[]"),
      }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" };
  const browser = await chromium.launch({ ...options, headless: true });
  try {
    const context = await browser.newContext(),
      seller = await context.newPage(),
      manager = await context.newPage(),
      errors = [],
      calls = [];
    for (const p of [seller, manager])
      p.on("pageerror", (e) => errors.push(e.message));
    const uid = "hosting-fixture",
      now = Math.floor(Date.now() / 1000),
      token =
        Buffer.from("{}").toString("base64url") +
        "." +
        Buffer.from(
          JSON.stringify({
            exp: now + 3600,
            iat: now,
            auth_time: now,
            user_id: uid,
            sub: uid,
          }),
        ).toString("base64url") +
        ".fixture";
    await context.route("**/api/auth/social/config", r => r.fulfill({headers: {"access-control-allow-origin": "*"}, json: {google:false,kakao:false,naver:false}}));
    await context.route("**/api/admin/access", r => r.fulfill({headers: {"access-control-allow-origin": "*"}, json: {isMaster:false,canSetup:false,needsRecentLogin:false}}));
    await context.route("**/identitytoolkit.googleapis.com/**", (r) =>
      r.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: r.request().url().includes("accounts:lookup")
          ? {
              users: [
                {
                  localId: uid,
                  email: "staff@example.test",
                  createdAt: String(Date.now()),
                  lastLoginAt: String(Date.now()),
                  providerUserInfo: [],
                },
              ],
            }
          : {
              idToken: token,
              refreshToken: "fixture",
              expiresIn: "3600",
              localId: uid,
              email: "staff@example.test",
              registered: true,
            },
      }),
    );
    const data = {
      merchantId: "studio-mina",
      totals: { count: 0, revenue: 0, average: 0 },
      payments: [],
      asOf: new Date().toISOString(),
      packages: [
        {
          id: "bedroom-lighting",
          name: "편안한 밤 조명 패키지",
          price: 99000,
          active: true,
          version: 1,
          spaceName: "침실",
        },
      ],
      roles: [{ role: "admin", count: 1 }],
      audit: [],
    };
    const cors = {
      "access-control-allow-origin": admin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Authorization,Content-Type",
    };
    await context.route("**/api/payments", (r) => r.fulfill({ json: data }));
    for (const path of ["overview", "packages"])
      await context.route("**/api/admin/" + path, async (r) => {
        const request = r.request(),
          requestHeaders = await request.allHeaders();
        if (request.method() === "OPTIONS")
          return r.fulfill({ status: 204, headers: cors });
        calls.push({
          path,
          origin: requestHeaders.origin,
          hasBearer: requestHeaders.authorization?.startsWith("Bearer "),
          hasCookie: !!requestHeaders.cookie,
        });
        if (path === "packages") {
          data.packages[0].active = false;
          data.packages[0].version++;
          data.audit = [
            {
              id: 1,
              product_id: "bedroom-lighting",
              old_active: 1,
              new_active: 0,
              created_at: new Date().toISOString(),
            },
          ];
          return r.fulfill({ headers: cors, json: { ok: true } });
        }
        return r.fulfill({ headers: cors, json: data });
      });
    async function login(page) {
      await page
        .getByLabel("이메일", { exact: true })
        .fill("staff@example.test");
      await page.getByLabel("비밀번호", { exact: true }).fill("fixture-only");
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await page.locator(".status-line").waitFor();
    }
    await seller.goto(merchant);
    await login(seller);
    assert.equal(
      await seller
        .getByRole("link", { name: "관리자 사이트", exact: true })
        .getAttribute("href"),
      admin,
    );
    await manager.goto(admin);
    assert.equal(
      await manager
        .getByRole("button", { name: "로그인", exact: true })
        .count(),
      1,
      "merchant login does not log into the separate admin origin",
    );
    await login(manager);
    await manager.locator(".package-card").waitFor();
    assert.equal(
      await manager
        .getByRole("link", { name: "판매자 센터", exact: true })
        .getAttribute("href"),
      merchant + "/",
    );
    await manager
      .getByRole("button", {
        name: "편안한 밤 조명 패키지 구매 중지하기",
        exact: true,
      })
      .click();
    await manager.locator(".new-order-notice").waitFor();
    assert.match(
      await manager.locator(".package-card").innerText(),
      /구매 중지/,
    );
    assert(calls.some((c) => c.path === "packages"));
    assert(
      calls.every((c) => c.origin === admin && c.hasBearer && !c.hasCookie),
    );
    await manager
      .getByRole("button", { name: "로그아웃", exact: true })
      .click();
    await manager
      .getByRole("button", { name: "로그인", exact: true })
      .waitFor();
    assert.equal(
      await seller
        .getByRole("button", { name: "로그아웃", exact: true })
        .count(),
      1,
      "admin logout leaves the merchant origin session intact",
    );
    assert.deepEqual(errors, []);
    const result = {
      method:
        "Two separate local origins, intercepted Auth/data APIs; real local CORS/unauthorized endpoint checks",
      preflight: true,
      missingTokenDenied: true,
      wrongOriginDenied: true,
      legacyRedirect: true,
      separateLoginSessions: true,
      adminBearerWithoutCookies: true,
      adminWriteAndReadback: true,
      separateLogout: true,
      pageErrors: errors,
    };
    fs.mkdirSync(".qa/admin-hosting", { recursive: true });
    fs.writeFileSync(
      ".qa/admin-hosting/verification.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
