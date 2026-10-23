import { signBody, type Payment } from "./domain.js";

export async function deliverPayment(payment: Payment, url: string, secret: string, transport: typeof fetch = fetch) {
  if (!url.startsWith("https://") || secret.length < 32) throw new Error("SYNC_CONFIG_INVALID");
  const body = JSON.stringify({schemaVersion: 1, payment});
  const timestamp = String(Date.now());
  const response = await transport(url, {method: "POST", body, redirect: "error",
    headers: {"content-type": "application/json", "x-sync-timestamp": timestamp, "x-sync-signature": signBody(body, timestamp, secret)},
    signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`SYNC_HTTP_${response.status}`);
}
