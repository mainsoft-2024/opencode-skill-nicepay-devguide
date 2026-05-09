# Signature formulas — every formula NICE uses, in one place

> Conflating these formulas is the #1 cause of `U312 SIGN DATA 검증
> 실패`. Each row below is a **distinct** formula. Inputs differ.
> `ediDate` is in some formulas and absent from others. Read carefully.

| # | Use case | Direction | Fields concatenated (in order) | Algorithm |
|---|---|---|---|---|
| 1 | **Return URL signature verification** | NICE → 가맹점 | `authToken + clientId + amount + secretKey` | `sha256` → hex |
| 2 | **Approve API request `signData`** | 가맹점 → NICE | `tid + amount + ediDate + secretKey` | `sha256` → hex |
| 3 | **Cancel API request `signData`** | 가맹점 → NICE | `tid + ediDate + secretKey` | `sha256` → hex |
| 4 | **Billing key issue `signData`** | 가맹점 → NICE | `orderId + ediDate + secretKey` | `sha256` → hex |
| 5 | **Billing key approve `signData`** | 가맹점 → NICE | `orderId + bid + ediDate + secretKey` | `sha256` → hex |
| 6 | **Webhook event signature** | NICE → 가맹점 | `authToken + clientId + orderId + amount + secretKey` (typical; verify per merchant config) | `sha256` → hex |

**ediDate format**: ISO 8601 with KST offset, e.g. `2026-04-01T15:30:00+09:00`.
The exact timestamp value does not matter as long as you use **the same string** in both the `signData` computation and the request body.

## Drop-in Node / TypeScript helpers

```typescript
// src/lib/nicepay/signature.ts
import { createHash, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";

const sha256Hex = (v: string) =>
  createHash("sha256").update(v, "utf8").digest("hex");

/**
 * (1) NICE → 가맹점.
 * Verify the `signature` POSTed to your `returnUrl`.
 * Formula: sha256(authToken + clientId + amount + secretKey)
 * NOTE: no ediDate in this formula.
 */
export const signReturnUrl = (i: {
  authToken: string;
  clientId: string;
  amount: string | number;
  secretKey: string;
}) => sha256Hex(`${i.authToken}${i.clientId}${i.amount}${i.secretKey}`);

/**
 * (2) 가맹점 → NICE.
 * `signData` for POST /v1/payments/{tid} body.
 * Formula: sha256(tid + amount + ediDate + secretKey)
 * NOTE: ediDate is required here. Reuse the SAME ediDate string in body.
 */
export const signApprove = (i: {
  tid: string;
  amount: string | number;
  ediDate: string;
  secretKey: string;
}) => sha256Hex(`${i.tid}${i.amount}${i.ediDate}${i.secretKey}`);

/** (3) Cancel: sha256(tid + ediDate + secretKey) */
export const signCancel = (i: {
  tid: string;
  ediDate: string;
  secretKey: string;
}) => sha256Hex(`${i.tid}${i.ediDate}${i.secretKey}`);

/** (4) Billing-key issue: sha256(orderId + ediDate + secretKey) */
export const signBilling = (i: {
  orderId: string;
  ediDate: string;
  secretKey: string;
}) => sha256Hex(`${i.orderId}${i.ediDate}${i.secretKey}`);

/** (5) Billing-key approve: sha256(orderId + bid + ediDate + secretKey) */
export const signBillingApprove = (i: {
  orderId: string;
  bid: string;
  ediDate: string;
  secretKey: string;
}) => sha256Hex(`${i.orderId}${i.bid}${i.ediDate}${i.secretKey}`);

/** (6) Webhook (typical merchant default). */
export const signWebhook = (i: {
  authToken: string;
  clientId: string;
  orderId: string;
  amount: string | number;
  secretKey: string;
}) => sha256Hex(
  `${i.authToken}${i.clientId}${i.orderId}${i.amount}${i.secretKey}`
);

/** Constant-time hex comparator. Use this for *every* incoming signature. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  const aa = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (aa.length !== bb.length) return false;
  return cryptoTimingSafeEqual(aa, bb);
}
```

## Golden test vectors

If you want to lock the formulas in unit tests:

```typescript
import { createHash } from "node:crypto";

// (1) Return URL
expect(signReturnUrl({ authToken: "a", clientId: "b", amount: "100", secretKey: "d" }))
  .toBe(createHash("sha256").update("ab100d").digest("hex"));

// (2) Approve API
expect(signApprove({ tid: "t", amount: "100", ediDate: "c", secretKey: "d" }))
  .toBe(createHash("sha256").update("t100cd").digest("hex"));

// (3) Cancel
expect(signCancel({ tid: "t", ediDate: "e", secretKey: "s" }))
  .toBe(createHash("sha256").update("tes").digest("hex"));
```

## Common mistakes (lived experience)

- ❌ Using the return-URL formula for the approve body, or vice versa.
- ❌ Including `ediDate` in the return-URL formula (there is no
  ediDate sent in the return POST).
- ❌ Computing `signData` with `tid` when the formula calls for
  `authToken` (or vice versa).
- ❌ Using a different `ediDate` string than the one sent in the body.
- ❌ Comparing signatures with `===` instead of constant-time. NICE
  signatures are not secret per se but the webhook handler should be
  resilient against timing oracle attacks anyway.
- ❌ Lowercasing/uppercasing the hex output. Compare as hex bytes.
