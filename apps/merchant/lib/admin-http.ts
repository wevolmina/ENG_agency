// The allowed browser origin is configuration, never a substitute for staff authorization.
export function configuredAdminOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const secure =
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname));
    if (
      !secure ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function adminOriginAllowed(
  request: Request,
  value = process.env.ADMIN_SITE_ORIGIN,
) {
  const origin = request.headers.get("Origin");
  // Same-origin/non-browser clients still pass the existing token + DB role check.
  return origin === null || origin === configuredAdminOrigin(value);
}
export function adminCors(
  request: Request,
  method: "GET" | "POST",
  value = process.env.ADMIN_SITE_ORIGIN,
): Record<string, string> {
  const origin = request.headers.get("Origin"),
    allowed = configuredAdminOrigin(value);
  return {
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    ...(origin && origin === allowed
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Methods": method + ", OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
export function adminOptions(
  request: Request,
  method: "GET" | "POST",
  value = process.env.ADMIN_SITE_ORIGIN,
) {
  const requested = request.headers.get("Access-Control-Request-Method");
  const requestedHeaders = (
    request.headers.get("Access-Control-Request-Headers") || ""
  )
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed =
    !!request.headers.get("Origin") &&
    adminOriginAllowed(request, value) &&
    requested === method &&
    requestedHeaders.every((s) =>
      ["authorization", "content-type"].includes(s),
    );
  return new Response(null, {
    status: allowed ? 204 : 403,
    headers: adminCors(request, method, value),
  });
}
