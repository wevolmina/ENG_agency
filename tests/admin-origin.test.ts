import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configuredAdminOrigin,
  adminOriginAllowed,
  adminCors,
  adminOptions,
} from "../apps/merchant/lib/admin-http";
const allowed = "https://admin.example.test";
function req(origin?: string, method = "GET") {
  return new Request("https://api.example.test/api/admin/overview", {
    method,
    headers: origin ? { Origin: origin } : {},
  });
}
test("admin origin configuration accepts exact origins, rejects credentials, paths and wildcards", () => {
  assert.equal(configuredAdminOrigin(allowed + "/"), allowed);
  assert.equal(
    configuredAdminOrigin("http://127.0.0.1:5190"),
    "http://127.0.0.1:5190",
  );
  for (const value of [
    undefined,
    "*",
    "null",
    "http://admin.example.test",
    "https://a:b@admin.example.test",
    "https://admin.example.test/path",
    "https://admin.example.test/?x=1",
  ])
    assert.equal(configuredAdminOrigin(value), null, value);
});
test("admin CORS matches one configured origin without allowing customer, sibling or suffix hosts", () => {
  assert.equal(adminOriginAllowed(req(allowed), allowed), true);
  for (const origin of [
    "https://paybridge-mock.web.app",
    "https://evil.example.test",
    "https://admin.example.test.evil.test",
    "null",
  ]) {
    assert.equal(adminOriginAllowed(req(origin), allowed), false);
    assert.equal(
      adminCors(req(origin), "GET", allowed)["Access-Control-Allow-Origin"],
      undefined,
    );
  }
  assert.equal(
    adminCors(req(allowed), "GET", allowed)["Access-Control-Allow-Origin"],
    allowed,
  );
  assert.equal(adminOriginAllowed(req(allowed), ""), false);
  assert.equal(adminOriginAllowed(req(), allowed), true);
  assert.equal(
    adminCors(req(allowed), "GET", allowed)["Access-Control-Allow-Credentials"],
    undefined,
  );
});
test("admin preflight permits required bearer/JSON headers and only the endpoint method", () => {
  const preflight = (
    origin: string,
    method: string,
    headers = "authorization,content-type",
  ) =>
    new Request("https://api.example.test/api/admin/packages", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": headers,
      },
    });
  assert.equal(
    adminOptions(preflight(allowed, "POST"), "POST", allowed).status,
    204,
  );
  assert.equal(
    adminOptions(
      preflight("https://evil.example.test", "POST"),
      "POST",
      allowed,
    ).status,
    403,
  );
  assert.equal(
    adminOptions(preflight(allowed, "DELETE"), "POST", allowed).status,
    403,
  );
  assert.equal(
    adminOptions(preflight(allowed, "POST", "cookie,x-extra"), "POST", allowed)
      .status,
    403,
  );
  assert.equal(adminOptions(req(), "GET", allowed).status, 403);
});
