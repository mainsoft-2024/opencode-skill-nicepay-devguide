# Pre-flight checklist — before going live

> Run through this list before flipping `NEXT_PUBLIC_PAYMENTS_ENABLED=true`
> in production. Each row corresponds to a real failure mode.

## NICE 가맹점 콘솔에서 확인

- [ ] **계약 상태**가 운영(LIVE)으로 활성화돼 있다.
- [ ] **개발정보 → KEY 정보**에서 발급된 키가:
  - 클라이언트 키 prefix가 `R1_` 또는 `R2_` (운영) — `S1_/S2_`는 sandbox.
  - 시크릿 키 길이가 **정확히 32바이트** (UTF-8 기준).
- [ ] **승인 모델**이 "Server 승인" 으로 설정돼 있다 (Client 승인이 아니라).
- [ ] **API 인증 방식**이 "Basic 인증" 으로 설정돼 있다 (Bearer가 아니라).
- [ ] **결제수단 사용 권한**:
  - 신용카드 ✅
  - 정기결제 (빌링) — 별도 승인 필요. 미승인 시 `F115`.
- [ ] **도메인 등록**: `splash.ai.kr` (또는 본인 도메인) 추가.
  - 미등록 시 결제창 호출 거부됨.
- [ ] **IP 화이트리스트**: 사용 시 Vercel functions egress IP 추가, 또는 비활성.
  - 미등록 IP 호출 시 `A224 / U315`.
- [ ] **웹훅 URL**: `https://<your-domain>/api/webhooks/nicepay` 등록.
  - 등록 통과 = GET/POST 모두 200 응답해야 함.
- [ ] **결과 통보 URL** (notiUrl, 가상계좌용): 같은 webhook 경로 또는 별도.

## 환경변수 (Vercel 또는 .env)

- [ ] `NICEPAY_CLIENT_ID` (R1_/R2_)
- [ ] `NICEPAY_SECRET_KEY` (32바이트)
- [ ] `NICEPAY_API_BASE=https://api.nicepay.co.kr`
- [ ] `NICEPAY_JS_SDK_URL=https://pay.nicepay.co.kr/v1/js/`
- [ ] `NEXT_PUBLIC_APP_URL=https://<your-domain>` — 결제창 returnUrl 빌드용
- [ ] `CRON_SECRET` (정기결제 cron 인증)
- [ ] `NEXT_PUBLIC_PAYMENTS_ENABLED=false` (카나리 끝나면 true)
- [ ] `NICEPAY_MODE=live` 또는 `test` — 너의 앱 게이팅용. NICE API의 모드가
  아니라 "이 환경에서 결제창을 노출/차단" 정책.

## CSP / 보안 헤더

`next.config.ts` (또는 동등 설정):

```
script-src  ... https://pay.nicepay.co.kr https://start-pay.nicepay.co.kr
connect-src ... https://api.nicepay.co.kr
frame-src   https://pay.nicepay.co.kr https://start-pay.nicepay.co.kr
```

빠지면 결제창 로딩 실패.

## DB 스키마

- [ ] `Payment.orderId` 에 unique 제약 → 멱등성 보장.
- [ ] `Payment.amount`, `Payment.currency`, `Payment.paymentMethod` 컬럼 존재.
- [ ] `WebhookEvent.eventId` 에 unique 제약 → replay 방지.
- [ ] `Invoice` 에 `(subscriptionId, periodStart)` unique → 정기결제 멱등성.
- [ ] `BillingKey` 에 `cardNo`/`cardPw`/`idNo` **컬럼 없음** (저장 금지).

## 코드 셀프체크

- [ ] returnUrl 핸들러가 `runtime = 'nodejs'` 명시 (`crypto` + `prisma` 사용).
- [ ] returnUrl 핸들러가 시그니처 검증에 `signReturnUrl` (no ediDate) 사용.
- [ ] approve API 호출 시 본문에 `signData = signApprove(tid + amount + ediDate + sk)` 포함.
- [ ] approve 응답의 `resultCode === "0000"` 만 성공으로 처리.
- [ ] webhook 핸들러가 모든 분기에서 200 ack.
- [ ] webhook `eventId` 유니크 → `P2002` catch → 200 ack.
- [ ] 빌링키 저장 시 `cardNo` 등 평문 카드 데이터 zero-fill.
- [ ] 로그에 `secretKey`, `authToken`, `signData`, 카드정보 마스킹.

## 카나리 시나리오 (운영 첫 거래)

1. `NICEPAY_MODE=live` + 운영 키로 deploy.
2. **본인 카드**로 1건 결제 (19,900원).
3. DB 확인:
   - `Payment.status='completed'`
   - `Subscription.tier='pro'`, `billingState='active'`
   - `nextBillingDate` = 다음 달 같은 날짜
4. NICE 매출전표 / 영수증 URL 확인.
5. **즉시 환불**: `/account/payments` 에서 환불 요청 → cancel API 호출.
6. DB 확인: `Payment.status='refunded'`, Subscription downgrade.
7. NICE 콘솔 거래 내역에서도 취소된 것 확인.
8. 통과되면 `NEXT_PUBLIC_PAYMENTS_ENABLED=true` 토글.

카나리 실패 신호:
- `U304/U305` → Basic 헤더 인코딩 검증
- `U312/A211` → signData 공식 비교 (`signature-formulas.md`)
- `U313` → clientId 오타 또는 가맹점 비활성
- `U315/A224` → IP 화이트리스트
- `A123` → amount mismatch (인증 시점 / 승인 시점 amount 불일치)
- `A245` → 인증 만료 (30분 초과 — 너무 느림, 즉시 승인 호출 필요)

## Webhook 검증 (등록 후)

NICE 콘솔에서 webhook 등록 → `Http status code: 200` 떠야 통과.

```bash
curl -i https://your-domain/api/webhooks/nicepay
# expect: HTTP/2 200, body "OK"
curl -i -X POST -d "" https://your-domain/api/webhooks/nicepay
# expect: HTTP/2 200, body "OK"
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"eventId":"manual-test","type":"test","tid":"x","signData":"bad"}' \
  https://your-domain/api/webhooks/nicepay
# expect: HTTP/2 200 (signatureValid=false 기록됨)
```

## Cron 검증

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/billing
# expect: { "ok": true, "processed": { "renewed": N, "failed": N, "downgraded": N } }
```

Vercel 에서 cron이 등록됐는지: `vercel.json` push + 자동 등록 확인.
