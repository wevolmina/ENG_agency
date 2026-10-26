// Shared domain helpers only. Firebase Cloud Functions are intentionally not exported.
// Order creation, immediate synchronization and daily reconciliation run on Vercel.
export * from "./domain.js";
