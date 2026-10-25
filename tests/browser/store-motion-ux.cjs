const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5188",
  output = process.env.UI_EVIDENCE_DIR || ".qa/dashboard-ux";
const products = [
  {
    id: "bedroom-lighting",
    name: "편안한 밤 조명 패키지",
    price: 99000,
    active: true,
  },
  {
    id: "kitchen-sensing",
    name: "주방 센서 조명 패키지",
    price: 99000,
    active: true,
  },
  {
    id: "desk-focus",
    name: "데스크테리어 집중 패키지",
    price: 79000,
    active: true,
  },
];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH
      ? {
          executablePath: process.env.BROWSER_EXECUTABLE_PATH,
          args: JSON.parse(process.env.BROWSER_ARGS_JSON || "[]"),
        }
      : { channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" }),
  });
  try {
    const context = await browser.newContext(),
      page = await context.newPage(),
      errors = [],
      requests = [];
    let result;
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    const uid = "ux-customer-fixture",
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
        ".fixture",
      cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      };
    await context.route("**/api/auth/social/config", r => r.fulfill({headers: {"access-control-allow-origin": "*"}, json: {google:false,kakao:false,naver:false}}));
    await context.route("**/identitytoolkit.googleapis.com/**", (r) =>
      r.fulfill({
        headers: cors,
        json: r.request().url().includes("accounts:lookup")
          ? {
              users: [
                {
                  localId: uid,
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
            },
      }),
    );
    await context.route("**/api/catalog", (r) =>
      r.fulfill({ headers: cors, json: { packages: products } }),
    );
    await context.route("**/api/cart-checkout", (r) => {
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ headers: cors, body: "" });
      const request = r.request().postDataJSON();
      requests.push(request);
      if (requests.length === 1) return r.abort("failed");
      result = {
        productId: "space-cart",
        paymentId: "pay_ux_fixture",
        orderId: "ord_ux_fixture",
        productName: "공간 패키지 3종",
        quantity: 3,
        amount: 277000,
        status: "MOCK_APPROVED",
        createdAt: new Date().toISOString(),
        items: products.map((p) => ({
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: p.price,
          lineTotal: p.price,
        })),
      };
      return r.fulfill({ headers: cors, json: result });
    });
    await context.route("**/api/receipt?**", (r) =>
      r.fulfill({ headers: cors, json: result }),
    );
    await page.goto(base, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".space-shortcuts a").count(), 3);
    assert.equal(await page.locator(".cart-empty").count(), 1);
    await page.getByLabel("침실 패키지 선택", { exact: true }).check();
    await page.locator(".mock-consent input").check();
    await page.getByLabel("주방 패키지 선택", { exact: true }).check();
    assert.equal(await page.locator(".mock-consent input").isChecked(), false);
    await page.getByLabel("데스크테리어 패키지 선택", { exact: true }).check();
    assert.equal(await page.getByTestId("cart-total").innerText(), "277,000원");
    if (process.env.QA_FONT_CSS) {
      await page.addStyleTag({
        content:
          fs.readFileSync(process.env.QA_FONT_CSS, "utf8") +
          '\nbody{font-family:"Noto Sans KR",sans-serif!important}',
      });
      await page.evaluate(() => document.fonts.ready);
    }
    fs.mkdirSync(output, { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        "overflow " + width,
      );
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: output + "/store-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: output + "/store-mobile.png",
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".cart-summary li")
        .first()
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    assert.equal(
      await page
        .locator(".shop-package.chosen img")
        .first()
        .evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    await page.locator(".mock-consent input").check();
    await page
      .getByRole("button", { name: "바로 구매 · 모의 결제", exact: true })
      .click();
    await page
      .getByRole("button", { name: "같은 주문 결과 다시 확인", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "같은 주문 결과 다시 확인", exact: true })
      .click();
    await page.locator(".completion.celebrate").waitFor();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(await page.locator(".cart-receipt-items li").count(), 3);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "complete-title",
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".completion").waitFor();
    assert.equal(await page.locator(".celebrate").count(), 0);
    assert.deepEqual(errors, []);
    const verification = {
      method:
        "Local store with intercepted Auth/catalog/checkout/receipt; no DB writes",
      spaceShortcuts: 3,
      emptyGuidance: true,
      total277000: true,
      consentResets: true,
      widthsWithoutOverflow: [320, 390, 768, 1440],
      reducedMotion: true,
      retryKeepsRequest: true,
      receiptFocus: true,
      restoreDoesNotReplay: true,
      pageErrors: errors,
    };
    fs.writeFileSync(
      output + "/store-verification.json",
      JSON.stringify(verification, null, 2),
    );
    console.log(JSON.stringify(verification));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
