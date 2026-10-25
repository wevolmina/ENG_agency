// Intercepted Auth and APIs: this test never creates a production order or edits a real package.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const base = process.env.STAFF_BASE_URL || "http://127.0.0.1:3000";
const adminBase = process.env.ADMIN_BASE_URL || "http://127.0.0.1:5190";
const output = process.env.UI_EVIDENCE_DIR || ".qa/dashboard-ux";
const headers = { "access-control-allow-origin": "*" };
const packages = [
  {
    id: "bedroom-lighting",
    name: "편안한 밤 조명 패키지",
    price: 99000,
    spaceName: "침실",
    active: true,
    version: 1,
  },
  {
    id: "kitchen-sensing",
    name: "주방 센서 조명 패키지",
    price: 99000,
    spaceName: "주방",
    active: true,
    version: 1,
  },
  {
    id: "desk-focus",
    name: "데스크테리어 집중 패키지",
    price: 79000,
    spaceName: "데스크테리어",
    active: false,
    version: 1,
  },
];
const payment = (id) => ({
  payment_id: id,
  order_id: "ord_" + id,
  product_name: "편안한 밤 조명 패키지",
  quantity: 1,
  amount: 99000,
  status: "MOCK_APPROVED",
  created_at: new Date().toISOString(),
});
function snapshot() {
  return {
    merchantId: "studio-mina",
    totals: { count: 1, revenue: 99000, average: 99000 },
    payments: [payment("baseline")],
    asOf: new Date().toISOString(),
    packages: structuredClone(packages),
    roles: [
      { role: "admin", count: 1 },
      { role: "merchant", count: 1 },
    ],
    audit: [],
  };
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const launch = process.env.BROWSER_EXECUTABLE_PATH
    ? {
        executablePath: process.env.BROWSER_EXECUTABLE_PATH,
        args: JSON.parse(process.env.BROWSER_ARGS_JSON || "[]"),
      }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" };
  const browser = await chromium.launch({ ...launch, headless: true });
  const results = [];
  try {
    for (const admin of [true, false]) {
      const context = await browser.newContext({
          viewport: { width: 1440, height: 1050 },
        }),
        page = await context.newPage(),
        errors = [];
      let data = snapshot(),
        reads = 0,
        failSave = false;
      page.on("pageerror", (e) => errors.push(e.message));
      const uid = "ux-fixture",
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
      await context.route("**/identitytoolkit.googleapis.com/**", (r) =>
        r.fulfill({
          headers,
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
                refreshToken: "fixture-refresh",
                expiresIn: "3600",
                localId: uid,
                email: "staff@example.test",
                registered: true,
              },
        }),
      );
      await context.route("**/api/admin/overview", (r) => {
        reads++;
        if (r.request().method() === "OPTIONS")
          return r.fulfill({
            status: 204,
            headers: {
              "access-control-allow-origin": adminBase,
              "access-control-allow-methods": "GET,POST,OPTIONS",
              "access-control-allow-headers": "Authorization,Content-Type",
            },
          });
        return r.fulfill({
          headers: { "access-control-allow-origin": adminBase },
          json: data,
        });
      });
      await context.route("**/api/payments", (r) => {
        reads++;
        if (r.request().method() === "OPTIONS")
          return r.fulfill({
            status: 204,
            headers: {
              "access-control-allow-origin": adminBase,
              "access-control-allow-methods": "GET,POST,OPTIONS",
              "access-control-allow-headers": "Authorization,Content-Type",
            },
          });
        return r.fulfill({
          headers: { "access-control-allow-origin": adminBase },
          json: data,
        });
      });
      await context.route("**/api/admin/packages", async (r) => {
        const cors = {
          "access-control-allow-origin": adminBase,
          "access-control-allow-methods": "POST,OPTIONS",
          "access-control-allow-headers": "Authorization,Content-Type",
        };
        if (r.request().method() === "OPTIONS")
          return r.fulfill({ status: 204, headers: cors });
        if (failSave)
          return r.fulfill({
            headers: cors,
            status: 409,
            json: { error: "CONFLICT" },
          });
        const request = r.request().postDataJSON();
        data.packages = data.packages.map((p) =>
          p.id === request.id
            ? { ...p, active: request.active, version: p.version + 1 }
            : p,
        );
        data.audit.unshift({
          id: 1,
          product_id: request.id,
          old_active: 1,
          new_active: 0,
          created_at: new Date().toISOString(),
        });
        return r.fulfill({ headers: cors, json: { ok: true } });
      });
      await page.clock.install();
      await page.goto(admin ? adminBase : base + "/", {
        waitUntil: "networkidle",
      });
      await page
        .getByLabel("이메일", { exact: true })
        .fill("staff@example.test");
      await page.getByLabel("비밀번호", { exact: true }).fill("fixture-only");
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await page.locator("table tbody td b").first().waitFor({state:"attached"});
      assert.equal(
        await page
          .locator(".new-order-notice,.metrics-updated,.new-order-row")
          .count(),
        0,
        "baseline stays quiet",
      );
      async function poll() {
        const before = reads;
        await page.clock.fastForward(admin ? 30010 : 5010);
        await page.waitForFunction(() => true);
        for (let i = 0; i < 100 && reads === before; i++)
          await new Promise((r) => setTimeout(r, 10));
        assert(reads > before, "poll executed");
        await page
          .getByText(data.payments[0].order_id, { exact: true })
          .waitFor({state:"attached"});
      }
      await poll();
      assert.equal(
        await page.locator(".new-order-notice").count(),
        0,
        "same snapshot stays quiet",
      );
      data.payments.unshift(payment("new"));
      data.totals = { count: 2, revenue: 198000, average: 99000 };
      await poll();
      if (admin) {
        assert.equal(
          await page
            .locator(".new-order-notice,.new-order-row,.metrics-updated")
            .count(),
          0,
          "admin general orders stay quiet",
        );
        assert.equal(await page.locator(".package-card").count(), 3);
        await page
          .getByRole("button", { name: "구매 중지", exact: true })
          .click();
        assert.equal(await page.locator(".package-card").count(), 1);
        await page
          .getByRole("button", { name: "스토어 공개", exact: true })
          .click();
        assert.equal(await page.locator(".package-card").count(), 2);
        const action = page.getByRole("button", {
          name: "편안한 밤 조명 패키지 구매 중지하기",
          exact: true,
        });
        await action.focus();
        await action.click();
        await page.locator(".new-order-notice").waitFor();
        assert.match(
          await page.locator(".new-order-notice").innerText(),
          /패키지 공개 상태 변경 1건/,
        );
        assert.equal(await page.locator(".package-card").count(), 1);
        assert.equal(
          await page
            .getByRole("button", { name: "스토어 공개", exact: true })
            .evaluate((e) => e === document.activeElement),
          true,
          "filter receives focus after its focused card is removed",
        );
        assert.equal(await page.locator(".audit-list li").count(), 1);
        await poll();
        assert.equal(
          await page.locator(".new-order-notice").count(),
          0,
          "audit is not repeated",
        );
        failSave = true;
        await page
          .getByRole("button", {
            name: "주방 센서 조명 패키지 구매 중지하기",
            exact: true,
          })
          .click();
        await page.locator(".package-section [role=alert]").waitFor();
        assert.match(
          await page.locator(".package-section [role=alert]").innerText(),
          /다른 변경/,
        );
        assert.equal(
          await page.locator(".package-card").count(),
          1,
          "conflict does not pretend success",
        );
        await page.getByRole("button", { name: "변경 오류 안내 닫기" }).click();
        await page.getByRole("button", { name: "전체", exact: true }).click();
      } else {
        await page.locator(".new-order-notice").waitFor();
        assert.equal(await page.locator(".new-order-row").count(), 1);
        assert.equal(await page.locator(".metrics-updated").count(), 1);
        await poll();
        await poll();
        await page.locator(".new-order-notice").waitFor({ state: "hidden" });
        assert.equal(
          await page
            .locator(".new-order-notice,.new-order-row,.metrics-updated")
            .count(),
          0,
          "same order never repeats",
        );
      }
      await page.clock.resume();
      if (process.env.QA_FONT_CSS) {
        await page.addStyleTag({
          content:
            fs.readFileSync(process.env.QA_FONT_CSS, "utf8") +
            '\n.auth-page,.shell,body{font-family:"Noto Sans KR",sans-serif!important}',
        });
        await page.evaluate(() => document.fonts.ready);
      }
      const sizes = [];
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1050 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          "page overflow " + width,
        );
        sizes.push(width);
      }
      if (admin) {
        await page.screenshot({
          path: output + "/admin-desktop.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path: output + "/admin-mobile.png",
          fullPage: true,
        });
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page
          .locator("button")
          .first()
          .evaluate((e) => getComputedStyle(e).transitionDuration),
        "0s",
      );
      assert.deepEqual(errors, []);
      results.push({
        role: admin ? "admin" : "merchant",
        baselineQuiet: true,
        unchangedQuiet: true,
        eventPolicy: true,
        widthsWithoutPageOverflow: sizes,
        reducedMotion: true,
        pageErrors: errors,
      });
      await context.close();
    }
    fs.writeFileSync(
      output + "/verification.json",
      JSON.stringify(
        {
          method:
            "Local production build, intercepted Auth/API responses, no production writes",
          results,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
