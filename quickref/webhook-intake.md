# Webhook intake — survive NICE's URL registration test

## The trap that costs everyone an afternoon

NICE 가맹점 콘솔에서 webhook URL을 등록하면 NICE는 등록 URL에 **더미
페이로드를 POST**해서 200 응답이 오는지 확인합니다. 이 더미는:

- 시그니처가 **없거나 무효**일 수 있음
- JSON 본문이 **비어있거나 빈 문자열**일 수 있음
- `Content-Type` 이 `application/json`이 아닐 수 있음

**따라서 webhook handler는 항상 200을 ack 해야 합니다.** 시그니처 검증
실패나 JSON 파싱 실패에 대해 4xx를 반환하면:

1. NICE 콘솔이 `Http status code : 400 Bad Request`로 등록을 거부.
2. 운영 중에도 NICE가 invalid event를 무한 재시도 → DB 부하.

## Correct intake pattern

```typescript
// app/api/webhooks/nicepay/route.ts
import { Prisma } from "@/generated/prisma/client";
import { signWebhook, timingSafeEqual } from "@/lib/nicepay/signature";
import { recordPaymentResult } from "@/lib/billing/record-payment";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 10;

const ack = () =>
  new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

// (a) URL 등록 검증용 GET / HEAD ping.
export async function GET()  { return ack(); }
export async function HEAD() { return new Response(null, { status: 200 }); }

// (b) Real webhook deliveries (and the dummy POST during registration).
export async function POST(request: Request): Promise<Response> {
  const bodyText = await request.text();

  // 빈 본문 / 깨진 JSON: 등록 검증 더미 가능성. 200으로 ack.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return ack();
  }

  const eventId = String(payload.eventId ?? `${payload.tid ?? ""}:${payload.ediDate ?? ""}`);
  const type    = String(payload.type    ?? "unknown");
  const tid     = String(payload.tid     ?? "");
  const orderId = String(payload.orderId ?? "");
  const amount  = Number(payload.amount ?? 0);
  const authToken = String(payload.authToken ?? "");
  const clientId  = String(payload.clientId  ?? env.NICEPAY_CLIENT_ID);
  const signData  = String(payload.signData  ?? "");

  const expected = signWebhook({
    authToken, clientId, orderId, amount, secretKey: env.NICEPAY_SECRET_KEY,
  });

  // 시그니처 불일치도 200 ack — 단, 흔적은 남김.
  if (!timingSafeEqual(expected, signData)) {
    try {
      await prisma.webhookEvent.create({
        data: {
          eventId, type,
          payload: payload as unknown as Prisma.InputJsonValue,
          signatureValid: false,
          processingError: "invalid_signature",
        },
      });
    } catch { /* P2002 on replay — ignore */ }
    return ack();
  }

  // 멱등 삽입: eventId 유니크 제약으로 자동 중복 차단.
  try {
    await prisma.webhookEvent.create({
      data: {
        eventId, type,
        payload: payload as unknown as Prisma.InputJsonValue,
        signatureValid: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return ack();   // replay
    }
    throw err;
  }

  // 타입별 dispatch — 실패해도 ack는 200 (NICE 무한 재시도 방지).
  try {
    await dispatch(type, payload);
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { processingError: message },
    });
  }
  return ack();
}

async function dispatch(type: string, p: Record<string, unknown>) {
  switch (type) {
    case "paid":
    case "vbankDeposited":
      await recordPaymentResult({
        subscriptionId: String(p.subscriptionId ?? ""),
        paymentResult: {
          orderId: String(p.orderId), providerPaymentId: String(p.tid),
          paid: true, amount: Number(p.amount), currency: "KRW",
          paymentMethod: type === "paid" ? "card" : "vbank",
          paymentType: "one_shot", raw: p,
        },
      });
      break;
    case "expired":
    case "vbankExpired":
      // mark Payment failed — handled in your domain layer
      break;
    case "cancelled":
    case "canceled":
      // refund event
      break;
    case "recurring_paid":
    case "billingPaid":
      // billing renewal success
      break;
    case "recurring_failed":
    case "billingFailed":
      // billing renewal failure
      break;
    default:
      // unknown — log to audit, do not throw
      break;
  }
}
```

## DB schema for `WebhookEvent`

```prisma
model WebhookEvent {
  id              String    @id @default(cuid())
  eventId         String    @unique          // dedup key
  type            String
  payload         Json
  signatureValid  Boolean
  receivedAt      DateTime  @default(now())
  processedAt     DateTime?
  processingError String?
  @@index([receivedAt])
}
```

## What about "real" rejection?

The right place to reject genuinely-bad events is **inside dispatch**:
write `processingError` to the row and return 200. Operationally,
monitor `WebhookEvent.signatureValid = false` and
`processingError IS NOT NULL` rows daily. They are anomalies but
should not back-pressure NICE.

## Summary

| Scenario | HTTP response |
|---|---|
| GET (URL registration ping) | 200 `OK` |
| HEAD (URL registration ping) | 200 |
| POST empty / malformed body | 200 `OK` |
| POST invalid signature | 200 `OK` (record `signatureValid:false`) |
| POST duplicate eventId (replay) | 200 `OK` |
| POST valid event, dispatch fails | 200 `OK` (record `processingError`) |
| POST valid event, dispatch succeeds | 200 `OK` |

There is **no scenario** where you should return 4xx/5xx from this
route except a true server-down (e.g. DB unreachable, in which case
return 500 and let NICE retry).
