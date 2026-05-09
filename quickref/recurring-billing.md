# Recurring billing — billing keys (빌링키)

## Concept

NICE 정기결제는 카드 정보를 **빌링키 (BID)** 로 토큰화한 뒤, 매 주기마다
빌링키로 결제 승인을 호출하는 구조입니다.

```
1. 사용자 카드 입력 → 평문 카드정보 → AES-256-CBC encData 생성
2. POST /v1/subscribe/regist  → BID 발급
3. (저장) BID + cardBrand + last4를 DB에 저장 (cardNo 절대 저장 금지)
4. 매 주기:
   POST /v1/subscribe/{BID}/payments  → 승인
5. 해지:
   POST /v1/subscribe/{BID}/expire
```

## Step 1 — encData (AES-256-CBC)

```typescript
// src/lib/nicepay/crypto.ts
import { createCipheriv } from "node:crypto";

/**
 * Encrypt billing-key registration plain text.
 *  - Algorithm: AES-256-CBC
 *  - Key: secretKey (must be exactly 32 bytes UTF-8)
 *  - IV: first 16 bytes of secretKey
 *  - Padding: PKCS7 (Node default for createCipheriv with auto-pad)
 *  - Output: hex-encoded ciphertext
 */
export function encryptBillingKeyData(
  plain: string,
  secretKey: string
): string {
  const keyBuf = Buffer.from(secretKey, "utf8");
  if (keyBuf.length !== 32) {
    throw new Error(`secretKey must be exactly 32 bytes, got ${keyBuf.length}`);
  }
  const iv = keyBuf.subarray(0, 16);
  const cipher = createCipheriv("aes-256-cbc", keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return enc.toString("hex");
}
```

**Plain-text format** (encMode `A2`):

```
cardNo=5409651234567890&expYear=27&expMonth=12&idNo=850101&cardPw=12
```

- `cardNo`: 카드 번호, no spaces / no dashes
- `expYear`: YY (2 digits)
- `expMonth`: MM (2 digits)
- `idNo`: 개인은 생년월일 6자리 (YYMMDD), 법인은 사업자번호 10자리
- `cardPw`: 카드 비밀번호 앞 2자리

평문 zeroize: encrypt 후 `Buffer.from(plain).fill(0)` 권장.

## Step 2 — 빌링키 발급 (BID 채번)

```typescript
import { signBilling } from "@/lib/nicepay/signature";
import { encryptBillingKeyData } from "@/lib/nicepay/crypto";

export async function issueBillingKey(input: {
  orderId: string;
  cardNo: string;
  expYY: string;
  expMM: string;
  idNo: string;
  cardPw: string;
}) {
  const cfg = getNicepayConfig();
  const ediDate = new Date().toISOString().replace("Z", "+09:00");

  const plain =
    `cardNo=${input.cardNo}&expYear=${input.expYY}` +
    `&expMonth=${input.expMM}&idNo=${input.idNo}&cardPw=${input.cardPw}`;
  const encData = encryptBillingKeyData(plain, cfg.secretKey);
  const signData = signBilling({
    orderId: input.orderId, ediDate, secretKey: cfg.secretKey,
  });

  const basic = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString("base64");
  const res = await fetch(`${cfg.apiBase}/v1/subscribe/regist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basic}`,
    },
    body: JSON.stringify({
      orderId: input.orderId,
      encData,
      encMode: "A2",
      ediDate,
      signData,
      returnCharSet: "utf-8",
    }),
  });
  type Resp = {
    resultCode: string;
    resultMsg: string;
    bid?: string;
    cardCode?: string;
    cardName?: string;
  };
  return (await res.json()) as Resp;
}
```

## Step 3 — 빌링키로 정기결제 승인

```typescript
import { signBillingApprove } from "@/lib/nicepay/signature";

export async function approveBillingPayment(input: {
  bid: string;
  orderId: string;
  amount: number;
  goodsName: string;
  cardQuota?: string;          // "00" 일시불 (default)
  buyerName?: string;
  buyerEmail?: string;
}) {
  const cfg = getNicepayConfig();
  const ediDate = new Date().toISOString().replace("Z", "+09:00");
  const signData = signBillingApprove({
    orderId: input.orderId, bid: input.bid, ediDate, secretKey: cfg.secretKey,
  });

  const basic = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString("base64");
  const res = await fetch(`${cfg.apiBase}/v1/subscribe/${input.bid}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basic}`,
    },
    body: JSON.stringify({
      orderId: input.orderId,
      amount: input.amount,
      goodsName: input.goodsName,
      cardQuota: input.cardQuota ?? "00",
      useShopInterest: false,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      ediDate,
      signData,
      returnCharSet: "utf-8",
    }),
  });
  return await res.json();
}
```

## Step 4 — 빌링키 만료(해지)

```typescript
import { signBilling } from "@/lib/nicepay/signature";

export async function expireBillingKey(input: { bid: string; orderId: string }) {
  const cfg = getNicepayConfig();
  const ediDate = new Date().toISOString().replace("Z", "+09:00");
  // 만료 signData는 발급과 동일 공식 (orderId + ediDate + secretKey)
  const signData = signBilling({
    orderId: input.orderId, ediDate, secretKey: cfg.secretKey,
  });

  const basic = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString("base64");
  const res = await fetch(`${cfg.apiBase}/v1/subscribe/${input.bid}/expire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basic}`,
    },
    body: JSON.stringify({ orderId: input.orderId, ediDate, signData, returnCharSet: "utf-8" }),
  });
  return await res.json();
}
```

## DB 저장 규칙

```prisma
model BillingKey {
  id        String   @id @default(cuid())
  userId    String
  bid       String   @unique     // NICE billing key
  cardBrand String?               // e.g. "삼성"
  last4     String?               // last 4 digits ONLY
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  // ⛔ DO NOT store cardNo, cardPw, idNo
}
```

PCI-DSS 권고: 카드 번호 / 유효기간 / 비밀번호 / 생년월일 모두 **DB에
저장 금지**. last4 + cardBrand만 사용자 식별 표시용으로 보관.

## Cron 스케줄러 패턴

```typescript
// app/api/cron/billing/route.ts (Vercel cron)
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const due = await prisma.subscription.findMany({
    where: { billingState: "active", nextBillingDate: { lte: new Date() } },
    take: 200,
  });
  for (const sub of due) {
    const bk = await prisma.billingKey.findUnique({
      where: { id: sub.activeBillingKeyId ?? "" },
    });
    if (!bk) continue;
    const orderId = generateOrderId(sub.userId);
    const result = await approveBillingPayment({
      bid: bk.bid,
      orderId,
      amount: getPlanAmount(sub.plan),
      goodsName: getGoodsName(sub.plan),
    });
    await recordPaymentResult({
      subscriptionId: sub.id,
      paymentResult: {
        orderId,
        providerPaymentId: result.tid,
        paid: result.resultCode === "0000",
        amount: result.amount,
        currency: "KRW",
        paymentMethod: "card",
        paymentType: "recurring",
        raw: result,
      },
    });
  }
  return Response.json({ ok: true });
}
```

`vercel.json` 등록:

```json
{ "crons": [{ "path": "/api/cron/billing", "schedule": "10 15 * * *" }] }
```

`10 15 * * *` UTC = 00:10 KST.

## Retry / grace 정책 권고

| 시도 | 다음 청구일 | 상태 |
|---|---|---|
| 1차 실패 | now + 1d | `pending_retry` |
| 2차 실패 | now + 3d | `pending_retry` |
| 3차 실패 | cancelEffectiveAt = now + 7d | `canceled_grace` |
| grace 만료 | tier='free', billingState='expired' | `expired` |

## 관련 코드

- `F100` 빌키 생성 성공 (실패 코드 아님)
- `F115` 빌키 발급 불가 가맹점 (정기결제 권한 미설정 → 영업담당)
- `F201` 이미 등록된 카드 — 기존 BID 재사용
