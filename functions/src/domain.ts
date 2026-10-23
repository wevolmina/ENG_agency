import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const catalog = {
  starter: { name: "데일리 노트", amount: 12000, merchantId: "studio-mina" },
  planner: { name: "위클리 플래너", amount: 24000, merchantId: "studio-mina" },
  bundle: { name: "워크 라이프 세트", amount: 39000, merchantId: "studio-mina" },
} as const;
export const createInput = z.object({
  productId: z.enum(["starter", "planner", "bundle"]),
  quantity: z.number().int().min(1).max(10),
  requestId: z.string().uuid(),
}).strict();
export const paymentSchema = z.object({
  paymentId: z.string().regex(/^pay_[a-f0-9]{40}$/),
  orderId: z.string().regex(/^ord_[a-f0-9]{40}$/),
  customerId: z.string().min(1).max(128),
  merchantId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  productId: z.enum(["starter", "planner", "bundle"]),
  productName: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(10),
  amount: z.number().int().positive().max(390000),
  currency: z.literal("KRW"),
  status: z.literal("MOCK_APPROVED"),
  createdAt: z.string().datetime(),
}).strict();
export type Payment = z.infer<typeof paymentSchema>;
export const syncSchema = z.object({schemaVersion: z.literal(1), payment: paymentSchema}).strict();

export function buildPayment(uid: string, input: z.infer<typeof createInput>, now = new Date()): Payment {
  const product = catalog[input.productId];
  const key = createHash("sha256").update(`${uid}:${input.requestId}`).digest("hex").slice(0, 40);
  return paymentSchema.parse({paymentId: `pay_${key}`, orderId: `ord_${key}`, customerId: uid,
    merchantId: product.merchantId, productId: input.productId, productName: product.name,
    quantity: input.quantity, amount: product.amount * input.quantity, currency: "KRW",
    status: "MOCK_APPROVED", createdAt: now.toISOString()});
}
export function sameOrder(a: Payment, b: Payment) {
  return a.customerId === b.customerId && a.productId === b.productId && a.quantity === b.quantity;
}
export function signBody(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
export function verifySignature(body: string, timestamp: string, signature: string, secret: string, now = Date.now()) {
  if (secret.length < 32 || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > 300000) return false;
  return timingSafeEqual(Buffer.from(signBody(body, timestamp, secret), "hex"), Buffer.from(signature, "hex"));
}
export function merchantFromClaims(claims: Record<string, unknown>): string | null {
  return typeof claims.merchant_id === "string" && /^[a-z0-9-]{1,64}$/.test(claims.merchant_id) ? claims.merchant_id : null;
}
export function paymentBody(data: Record<string, unknown>) {
  const {paymentId, orderId, customerId, merchantId, productId, productName, quantity, amount, currency, status, createdAt} = data;
  return paymentSchema.parse({paymentId, orderId, customerId, merchantId, productId, productName, quantity, amount, currency, status, createdAt});
}
