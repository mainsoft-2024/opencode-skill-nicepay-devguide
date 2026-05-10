# Cancel · Refund · 망취소

## 세 가지 시나리오

| 케이스 | 시점 | API | 비고 |
|---|---|---|---|
| **취소 (전체)** | 결제 당일 또는 이후 | `POST /v1/payments/{tid}/cancel` | `cancelAmt` 생략 → 전액 취소 |
| **부분 취소** | 결제 이후 | 같은 endpoint | `cancelAmt` 명시. 부분취소 결과 별도 tid 채번됨 |
| **망취소** | 승인 직후 read-timeout | 같은 endpoint, 동일 paramset | 5분 이내 권장. NICE 측에서도 별도 처리 |

## 코드

```typescript
// src/lib/nicepay/payments.ts
import { signCancel } from "./signature";
import { getNicepayConfig } from "./config";

export async function cancelPayment(input: {
  tid: string;
  orderId: string;                // ⚠️ 필수. 전액취소엔 원거래 orderId 재사용, 부분취소엔 새 고유 orderId.
  reason: string;
  cancelAmt?: number;             // omit for full
  taxFreeAmt?: number;
  refundAccount?: string;         // 가상계좌 환불용
  refundBankCode?: string;
  refundHolder?: string;
}) {
  const cfg = getNicepayConfig();
  const ediDate = new Date().toISOString().replace("Z", "+09:00");
  const signData = signCancel({
    tid: input.tid, ediDate, secretKey: cfg.secretKey,
  });
  const basic = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString("base64");

  const body: Record<string, unknown> = {
    orderId: input.orderId,        // U100 방지용 최상단 명시
    reason: input.reason,
    ediDate,
    signData,
    returnCharSet: "utf-8",
  };
  if (input.cancelAmt !== undefined)     body.cancelAmt     = input.cancelAmt;
  if (input.taxFreeAmt !== undefined)    body.taxFreeAmt    = input.taxFreeAmt;
  if (input.refundAccount)               body.refundAccount = input.refundAccount;
  if (input.refundBankCode)              body.refundBankCode= input.refundBankCode;
  if (input.refundHolder)                body.refundHolder  = input.refundHolder;

  const res = await fetch(`${cfg.apiBase}/v1/payments/${input.tid}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basic}`,
    },
    body: JSON.stringify(body),
  });
  type Resp = {
    resultCode: string;
    resultMsg: string;
    tid: string;
    cancelledTid?: string;        // 부분취소 시 새 tid
    cancelledAt?: string;
    balanceAmt?: number;          // 남은 취소 가능 금액
  };
  return (await res.json()) as Resp;
}
```

## 망취소 권고 패턴

승인 호출이 read-timeout일 때:

```typescript
let approveResp;
try {
  approveResp = await fetch(approveUrl, { ... });  // 정상 흐름
} catch (err) {
  // 망취소: 같은 tid로 cancel 호출. NICE가 미승인 상태면 안전하게 무시.
  await cancelPayment({ tid, orderId: originalOrderId, reason: "network_timeout_net_cancel" });
  throw err;
}
```

`2020 망상 취소 허용시간 초과`가 나오면 이미 망취소 윈도우(보통 5분)
를 넘긴 것 — 일반 cancel API로 전환.

## 환불 정책 (가맹점 자체 정책 예시)

| 조건 | 자가환불 가능 | 처리 |
|---|---|---|
| 결제일로부터 7일 이내 + 사용 0 | ✅ | 즉시 cancel API 호출 |
| 결제일로부터 7일 초과 | ❌ | 운영팀 수동 처리 (admin-only) |
| 사용 이력 있음 | ❌ | 운영팀 수동 처리 |

```typescript
// tRPC mutation 예시
requestRefund: protectedProcedure
  .input(z.object({ paymentId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const payment = await ctx.prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
    if (payment.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    if (payment.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST" });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (payment.createdAt < sevenDaysAgo)
      throw new TRPCError({ code: "BAD_REQUEST", message: "7일 환불 기간 초과" });

    const usage = await ctx.prisma.usageLog.count({
      where: { userId: ctx.session.user.id, createdAt: { gte: payment.createdAt } },
    });
    if (usage > 0)
      throw new TRPCError({ code: "BAD_REQUEST", message: "사용 이력이 있어 자가환불 불가" });

    const result = await cancelPayment({
      tid: payment.providerPaymentId!,
      orderId: payment.orderId,           // 원거래 orderId 재사용 (전액취소)
      reason: "사용자 요청 환불",
    });
    if (result.resultCode !== "0000") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `환불 실패: ${result.resultMsg}`,
      });
    }
    // record refund event in your billing layer
    return { ok: true };
  });
```

## 부분 취소 주의사항

- 부분 취소 시 `cancelledTid`는 **새로 채번된 tid**. 원거래 tid와 다름.
- 부분 취소를 여러 번 할 경우, 매번 새 `orderId`를 보내야 함.
- 가상계좌 환불은 `refundAccount` / `refundBankCode` / `refundHolder` 필수.
- 신용카드 부분 취소는 카드사 정책상 불가능한 케이스 있음 (`2028 부분취소
  불가능 가맹점`, `2029 부분취소 불가능 결제수단`).

## 관련 코드

- `0000` 인증 / 호출 자체는 OK (취소 성공인지는 `2001` 별도 확인)
- `U100` **`<param>` 필수입력항목이 누락되었습니다** — 본문에 `orderId` 또는 `reason` 등 필수 필드 빠짐
- `2001` 취소 성공
- `2014` 취소 불가능 거래 (이미 취소됨 / 시한 초과)
- `2015` 기 취소 요청 (중복 호출)
- `2016` 취소 기한 초과
- `2020` 망상 취소 허용시간 초과
- `2032` 취소금액이 취소가능금액보다 큼
