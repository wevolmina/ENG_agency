import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { buildPayment, createInput, paymentBody, sameOrder } from "./domain.js";
import { deliverPayment } from "./delivery.js";

initializeApp();
const db = getFirestore();
const syncSecret = defineSecret("SYNC_SHARED_SECRET");
const syncUrl = defineString("SYNC_API_URL");
const region = "asia-northeast3";

export const createPayment = onCall({region, maxInstances: 5}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인 후 결제해 주세요.");
  const parsed = createInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "상품과 수량을 확인해 주세요.");
  const payment = buildPayment(request.auth.uid, parsed.data);
  const ref = db.collection("payments").doc(payment.paymentId);
  return db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    if (previous.exists) {
      const existing = paymentBody(previous.data()!);
      if (!sameOrder(existing, payment)) throw new HttpsError("already-exists", "같은 요청 번호의 주문 내용이 다릅니다.");
      return {paymentId: existing.paymentId};
    }
    tx.create(ref, {...payment, syncState: "pending", syncAttempts: 0, recordedAt: FieldValue.serverTimestamp()});
    return {paymentId: payment.paymentId};
  });
});

async function synchronize(paymentId: string) {
  const ref = db.collection("payments").doc(paymentId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.get("syncState") === "synced") return;
  const payment = paymentBody(snapshot.data()!);
  try {
    await deliverPayment(payment, syncUrl.value(), syncSecret.value());
    await ref.update({syncState: "synced", syncedAt: FieldValue.serverTimestamp(), lastSyncError: FieldValue.delete(), syncAttempts: FieldValue.increment(1)});
  } catch (error) {
    const code = error instanceof Error && /^SYNC_(HTTP_\d{3}|CONFIG_INVALID)$/.test(error.message) ? error.message : "SYNC_DELIVERY_FAILED";
    // Original payment fields remain immutable. Acknowledged deliveries win over concurrent failures.
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.get("syncState") !== "synced") tx.update(ref, {lastSyncError: code, lastSyncAttemptAt: FieldValue.serverTimestamp(), syncAttempts: FieldValue.increment(1)});
    });
    logger.error("Payment synchronization failed", {paymentId, code});
    throw new Error(code);
  }
}
export const syncPayment = onDocumentCreated({document: "payments/{paymentId}", region, retry: true, secrets: [syncSecret], maxInstances: 5}, async event => {
  await synchronize(event.params.paymentId);
});
export const reconcilePayments = onSchedule({schedule: "every 15 minutes", timeZone: "Asia/Seoul", region, secrets: [syncSecret], maxInstances: 1}, async () => {
  const pending = await db.collection("payments").where("syncState", "==", "pending").limit(100).get();
  for (const item of pending.docs) {
    try { await synchronize(item.id); } catch { /* next scheduled run retries; safe code was already logged */ }
  }
});
