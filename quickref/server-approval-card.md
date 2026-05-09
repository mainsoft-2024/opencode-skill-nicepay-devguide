# Server-approval card payment — Node / Next.js end-to-end

> Verified working against NICE V2 Server 승인 + Basic 인증 in production.
> Drop these snippets in. They handle the gotchas that cost real hours.

## Sequence

```
Browser                      Your server                   NICE
   │                              │                         │
   │ 1. POST createCheckoutSession│                         │
   │     plan: 'monthly' | 'yearly'                         │
   │ ────────────────────────────►│                         │
   │                              │ Insert pending Payment  │
   │                              │ Generate orderId         │
   │ ◄──── { orderId, amount, ... }│                        │
   │                              │                         │
   │ 2. AUTHNICE.requestPay({...})│                         │
   │      with returnUrl=         │                         │
   │      yourdomain/api/.../return                          │
   │ ──────────────────────────────────────────────────────►│
   │                              │                         │
   │            (NICE 결제창)      │                         │
   │                              │                         │
   │ 3. NICE POSTs result         │                         │
   │    to returnUrl (form-urlencoded)                      │
   │ ◄──────────────────────────── │ ◄──────────────────────│
   │                              │                         │
   │                              │ 4. Verify signature      │
   │                              │ 5. Verify amount         │
   │                              │ 6. POST /v1/payments/{tid}│
   │                              │ ──────────────────────► │
   │                              │ ◄────── { resultCode } ─│
   │                              │                         │
   │                              │ 7. If 0000: tier=pro,    │
   │                              │    nextBilling=+1m      │
   │                              │                         │
   │ 8. 303 redirect to          │                         │
   │    /account/payments?status=success                     │
   │ ◄──────────────────────────── │                         │
```

## 1. Client checkout button (Next.js client component)

```tsx
"use client";

import { useCallback } from "react";
import { toast } from "sonner";

interface NicepaySdk {
  requestPay: (opts: Record<string, unknown>) => void;
}
interface WindowWithNicepay extends Window { AUTHNICE?: NicepaySdk }

export type CheckoutSession = {
  orderId: string;
  amount: number;
  goodsName: string;
  clientId: string;
  returnUrl: string;
  buyerName?: string;
  buyerEmail?: string;
};

export function useNicepay() {
  const requestPay = useCallback((session: CheckoutSession) => {
    if (typeof window === "undefined") return;
    const sdk = (window as WindowWithNicepay).AUTHNICE;
    if (!sdk) {
      toast.error("결제 모듈이 아직 로드되지 않았어요. 잠시 후 다시 시도하세요.");
      return;
    }
    sdk.requestPay({
      clientId: session.clientId,
      method: "card",
      orderId: session.orderId,
      amount: session.amount,
      goodsName: session.goodsName,
      returnUrl: session.returnUrl,
      buyerName: session.buyerName,
      buyerEmail: session.buyerEmail,
      // ⚠️ MANDATORY. Omitting this triggers
      // "필수 파라미터 fnError Funtion 누락되었습니다".
      fnError: (result: { msg?: string; errorMsg?: string }) => {
        toast.error(`${result.msg ?? "결제 오류"} (${result.errorMsg ?? ""})`);
      },
    });
  }, []);
  return { requestPay };
}
```

Load the SDK once via `<script src="https://pay.nicepay.co.kr/v1/js/" />`
(use Next's `<Script strategy="afterInteractive">`).

## 2. Server: create checkout session (tRPC / route handler)

```typescript
// In your tRPC mutation or POST handler:
import { generateOrderId } from "@/lib/nicepay/order-id";

const userId = ctx.session.user.id;
const amount = plan === "monthly" ? 19900 : 199000;
const goodsName = plan === "monthly" ? "Splash Pro 월간" : "Splash Pro 연간";

let orderId = "";
for (let i = 0; i < 3; i++) {
  orderId = generateOrderId(userId);  // splash_<u>_<epoch>_<rand4>
  try {
    await ctx.prisma.payment.create({
      data: {
        orderId, amount, currency: "KRW",
        status: "pending",
        userId, subscriptionId,
        paymentType: "one_shot", paymentMethod: "card",
      },
    });
    break;
  } catch (err) {
    if (i === 2) throw err;       // exhausted retries
  }
}

return {
  orderId,
  amount,
  goodsName,
  currency: "KRW" as const,
  clientId: env.NICEPAY_CLIENT_ID,
  returnUrl: `${env.NEXT_PUBLIC_APP_URL}/api/payments/nicepay/return`,
  buyerName: ctx.session.user.name ?? undefined,
  buyerEmail: ctx.session.user.email ?? undefined,
};
```

## 3. Server: return-URL handler (the critical one)

```typescript
// app/api/payments/nicepay/return/route.ts
import { Prisma } from "@/generated/prisma/client";
import { signReturnUrl, signApprove, timingSafeEqual } from "@/lib/nicepay/signature";
import { recordPaymentResult } from "@/lib/billing/record-payment";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const REDIRECT = "/account/payments";
const redirect = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path } });

export async function POST(request: Request): Promise<Response> {
  try {
    const f = await request.formData();
    const authResultCode = String(f.get("authResultCode") ?? "");
    const tid            = String(f.get("tid") ?? "");
    const orderId        = String(f.get("orderId") ?? "");
    const amount         = String(f.get("amount") ?? "");
    const authToken      = String(f.get("authToken") ?? "");
    const signature      = String(f.get("signature") ?? "");
    const ediDate        = String(f.get("ediDate") ?? "");

    // (1) Authentication step. Anything other than 0000 means the user
    // never completed authentication — do NOT call approve.
    if (authResultCode !== "0000") {
      return redirect(`${REDIRECT}?status=failed&reason=auth_${authResultCode}`);
    }

    // (2) Look up the pending Payment we created earlier.
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment || payment.status !== "pending") {
      return redirect(`${REDIRECT}?status=failed&reason=unknown_order`);
    }

    // (3) Verify return-URL signature. Formula (1) — no ediDate.
    const expected = signReturnUrl({
      authToken,
      clientId: env.NICEPAY_CLIENT_ID,
      amount,
      secretKey: env.NICEPAY_SECRET_KEY,
    });
    if (!timingSafeEqual(expected, signature)) {
      await prisma.payment.update({
        where: { orderId },
        data: { status: "failed", errorCode: "signature_mismatch" },
      });
      return redirect(`${REDIRECT}?status=failed&reason=signature_mismatch`);
    }

    // (4) Verify amount tampering.
    if (Number(amount) !== payment.amount) {
      await prisma.payment.update({
        where: { orderId },
        data: { status: "failed", errorCode: "amount_mismatch" },
      });
      return redirect(`${REDIRECT}?status=failed&reason=amount_mismatch`);
    }

    // (5) Approve. Formula (2) for body signData — uses tid, not authToken.
    const approveEdiDate = new Date().toISOString().replace("Z", "+09:00");
    const approveSignData = signApprove({
      tid,
      amount: Number(amount),
      ediDate: approveEdiDate,
      secretKey: env.NICEPAY_SECRET_KEY,
    });
    const basic = Buffer
      .from(`${env.NICEPAY_CLIENT_ID}:${env.NICEPAY_SECRET_KEY}`)
      .toString("base64");

    const approveRes = await fetch(`${env.NICEPAY_API_BASE}/v1/payments/${tid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basic}`,
      },
      body: JSON.stringify({
        amount: Number(amount),
        ediDate: approveEdiDate,
        signData: approveSignData,
        returnCharSet: "utf-8",
      }),
    });

    // ⚠️ NICE returns HTTP 200 even for logical failure. Check resultCode.
    type ApproveResp = {
      resultCode: string;
      resultMsg: string;
      tid: string;
      orderId: string;
      amount: number;
      paidAt?: string;
      status?: string;
      receiptUrl?: string;
    };
    const approve: ApproveResp = await approveRes.json();

    if (approve.resultCode !== "0000") {
      await prisma.payment.update({
        where: { orderId },
        data: {
          status: "failed",
          errorCode: approve.resultCode,
          errorMessage: approve.resultMsg ?? null,
        },
      });
      return redirect(
        `${REDIRECT}?status=failed&reason=approval_${approve.resultCode}` +
        `&detail=${encodeURIComponent(approve.resultMsg ?? "")}`
      );
    }

    // (6) Record success. State machine handles tier upgrade + nextBillingDate.
    await recordPaymentResult({
      subscriptionId: payment.subscriptionId,
      paymentResult: {
        orderId: approve.orderId,
        providerPaymentId: approve.tid,
        providerTransactionId: approve.tid,
        paid: true,
        amount: approve.amount,
        currency: "KRW",
        paidAt: approve.paidAt ? new Date(approve.paidAt) : new Date(),
        paymentMethod: "card",
        paymentType: "one_shot",
        raw: approve,
      },
    });

    return redirect(`${REDIRECT}?status=success&orderId=${encodeURIComponent(orderId)}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[nicepay-return] internal error", { msg });
    // Surface the message in the redirect so debugging doesn't require log access.
    return redirect(
      `${REDIRECT}?status=failed&reason=internal_error&detail=${encodeURIComponent(msg)}`
    );
  }
}
```

## 4. Order ID generator (idempotency key)

```typescript
// src/lib/nicepay/order-id.ts
import { randomBytes } from "node:crypto";

export const ORDER_ID_REGEX =
  /^splash_[A-Za-z0-9]{8}_\d{10}_[A-Za-z0-9]{4}$/;

export function generateOrderId(userId: string): string {
  const userPart = (userId.replace(/[^A-Za-z0-9]/g, "") + "xxxxxxxx").slice(0, 8);
  const epoch = Math.floor(Date.now() / 1000).toString().padStart(10, "0");
  const rand = randomBytes(3).toString("base64url").replace(/[^A-Za-z0-9]/g, "x").slice(0, 4).padEnd(4, "x");
  const id = `splash_${userPart}_${epoch}_${rand}`;
  if (!ORDER_ID_REGEX.test(id)) throw new Error(`Invalid orderId: ${id}`);
  return id;
}
```

Ensure the orderId column has a unique index — that gives you free
idempotency on duplicate webhook deliveries / browser refreshes.

## Why this works on the first try

- Both signatures use the correct (different) formulas.
- Approve body has `signData` so the merchant's sign-enforcement
  setting cannot trigger `U312`.
- `resultCode !== "0000"` is treated as a hard failure even if HTTP
  is 200 — prevents the state machine from receiving an inconsistent
  `paid:false` charge_succeeded event.
- `internal_error` redirects carry the error message — first triage
  is one URL away.
- Idempotency by orderId — duplicate webhook/return submissions are
  no-ops.

## Integrating with a state machine (optional but recommended)

Use a billing-state machine such that:

```
free          → charge_succeeded → active
active        → charge_failed    → pending_retry
pending_retry → charge_succeeded → active
pending_retry → charge_failed[3] → expired
active        → user_canceled    → canceled_grace
canceled_grace→ user_uncanceled  → active
canceled_grace→ grace_expired    → expired
```

Crucial: **`free → charge_failed` must be a no-op** (or at least not
throw) because a first-payment failure is a legitimate outcome.
NICE returning a non-zero resultCode on the very first payment will
land here. Letting the state machine throw on this transition crashes
the return route.
