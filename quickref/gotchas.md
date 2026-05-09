# Gotchas — pitfalls collected from real integration debugging

> 매 항목은 **실제 시간을 잡아먹은 함정**입니다. 새 세션 에이전트가 이걸 한 번
> 훑으면 같은 자리에서 멈추지 않습니다.

## Signature

- **`U312 SIGN DATA 검증 실패` 의 90%는 returnUrl 공식과 approve API 본문
  공식을 혼동해서.** Return URL 공식에는 `ediDate`가 **없고**, approve 본문
  에는 **있다**. `signature-formulas.md` 참고.
- approve API 본문에 `signData`를 아예 안 보내도 가맹점 sign 검증 설정이
  켜져 있으면 `U312`. 기본값으로 항상 `signData` 포함이 안전.
- `signData` 값을 lowercase / uppercase 변환 금지. NICE가 보낸 hex
  문자열 그대로 비교.

## HTTP & resultCode 의미체계

- NICE는 **거의 모든 논리 오류에 HTTP 200을 반환**한다. 비즈니스 결과는
  `resultCode === "0000"`로만 판정한다. HTTP status code로 분기하지 마.
- HTTP 401 = Basic auth 자체가 틀렸을 때. resultCode 200으로도 옴
  (`U304`).
- HTTP 5xx 또는 read-timeout → **망취소** 발동. 같은 tid로 즉시 cancel
  호출. NICE가 미승인 상태면 그냥 무시되고, 승인됐으면 자동 취소됨.

## Webhook

- **URL 등록할 때 NICE는 더미 POST를 보낸다.** 시그니처 없거나 본문
  비어있을 수 있음 → 모든 케이스 200 ack 필수. 4xx 던지면 등록 거부됨
  (`Http status code : 400 Bad Request`).
- webhook handler에서 invalid signature 도 200 ack. DB에 `signatureValid:
  false`로 기록만. 4xx 반환 시 NICE 무한 재시도로 DB 부하.
- 같은 이벤트가 두 번 이상 도착할 수 있다. `eventId`에 unique 인덱스 →
  P2002 catch → 200 ack 패턴이 정석.

## SDK & 결제창

- `AUTHNICE.requestPay({...})`에 **`fnError` 콜백은 필수**. 없으면 결제창
  로딩 시 `필수 파라미터 fnError Funtion 누락되었습니다` 에러.
- SDK URL은 `https://pay.nicepay.co.kr/v1/js/` (slash로 끝남). 파일명
  추가하지 말 것 — `/v1/js/nicepay-pay.js` 같은 경로는 404.
- SDK는 `next/script strategy="afterInteractive"` 로 한 번만 주입. 여러
  번 주입하면 `AUTHNICE` global이 race로 깨질 수 있음.
- 결제창 인증과 승인 호출 사이가 **30분 초과 시 `A245` 만료**. 사용자가
  결제창 열고 식사 갔다오면 만료. 클라이언트는 인증 직후 즉시 returnUrl
  로 POST 되므로 일반적으로 문제 없음.

## Authentication (Basic)

- 헤더 형식: `Authorization: Basic <base64(clientId:secretKey)>`. 콜론
  하나, 공백 없음, URL-encode 없음.
- secretKey는 **정확히 32바이트 UTF-8**. 길이 다르면 AES 암호화 단계
  에서 throw.
- 헤더 base64 만들 때 `Buffer.from('id:sk').toString('base64')` 또는
  `btoa('id:sk')`. **trailing newline 포함 금지** (어떤 라이브러리는 자동
  추가).

## OrderId 멱등성

- `orderId`는 가맹점이 채번. **한 번 결제(승인)된 orderId는 재사용 불가**.
  `P015` orderId 중복 오류 발생.
- 부분 취소 시에도 새 orderId 필요. 환불 호출 시 `orderId` 누락하지 말 것.
- DB의 Payment.orderId에 unique 제약 → 더블 클릭, 새로고침으로 인한
  중복 결제 자동 차단.

## Amount

- 정수 (원). 소수점 없음.
- `amount` 필드는 인증 시점과 승인 시점이 동일해야 함. 불일치 시 `A123`.
- 환불은 `cancelAmt` 로 부분/전체 명시. `cancelAmt` 생략 = 전액 취소.
- VAT 포함 / 면세는 `taxFreeAmt` 로 별도 명시. 면세 사업자가 아니면
  보통 0 또는 생략.

## 카드 데이터 보안

- DB에 **카드번호 / 유효기간 / 비밀번호 / 생년월일 저장 금지**. PCI-DSS
  위반.
- 빌링키 저장 시 식별 표시용으로 `cardBrand` (예: "삼성") + `last4`
  만 저장.
- encData 평문 string은 use 후 `Buffer.from(plain).fill(0)` 로 zeroize.

## Vercel/Next.js 특이사항

- 결제 관련 모든 route handler에 `export const runtime = 'nodejs'` 필수.
  Edge runtime은 `node:crypto` 없음 → AES / sha256 실패.
- `runtime = 'nodejs'` + `maxDuration` 명시 (return 60s, webhook 10s,
  cron 300s).
- `Response.redirect(path, 303)` 은 **절대 URL** 필요. 경로만 줄 거면
  `new Response(null, { status: 303, headers: { Location: path } })` 패턴.
- `request.formData()` 호출 시 `Content-Type` 자동 인식. NICE가 보내는
  `application/x-www-form-urlencoded` 정상 파싱됨.
- middleware.ts 의 `matcher`가 `/api/**` 를 제외하고 있는지 확인. 결제
  라우트가 auth 미들웨어에 막히면 NICE 콜백이 401 받음.

## CSRF / 인증 우회

- `/api/payments/nicepay/return` 와 `/api/webhooks/nicepay` 는 외부 호출
  엔드포인트 → CSRF 토큰 검증 우회 필요. **신뢰는 시그니처 검증으로** 한다.
- `/api/cron/billing` 은 Vercel Cron 만 호출 → `Authorization: Bearer
  ${CRON_SECRET}` 로 게이트.

## State machine

- `free → charge_failed` 는 정상 시나리오 (첫 결제 실패). 불법 전이로
  막지 말 것. 그렇지 않으면 NICE 거절 시 return route가 500.
- `charge_succeeded`는 free / pending_retry 두 상태 모두에서 active로
  전이 허용.
- `refunded` 이벤트는 active → active 유지 + payment row update.

## 도메인 / mailto / placeholder

- 운영 도메인 발급 후 **mailto: 의 도메인도 함께 갱신**. `hello@usesplash.
  vercel.app` 같은 placeholder 도메인이 운영 페이지에 남아있으면 버그
  리포트가 안 옴.
- `NEXT_PUBLIC_APP_URL` 도 운영 도메인으로 통일. 그렇지 않으면 결제 후
  vercel.app 으로 리다이렉트되어 사용자가 혼란.

## 가맹점 키 발급 라벨 해석

NICE 콘솔에서 키 발급 시 라벨 두 개 함께 노출됨:

```
클라이언트 키	Server 승인 R2_xxxxxxxx
시크릿 키	Basic 인증     yyyyyyyy
```

여기서 "Server 승인 / Basic 인증" 은 **이 키 페어가 그 모드에서만 사용
가능** 하다는 의미. Client 승인 / Bearer 토큰을 쓰려면 별도 발급.

## 망취소 윈도우

- 보통 **5분**. 5분 초과 시 `2020 망상 취소 허용시간 초과` → 일반 cancel
  로 전환.
- 망취소 호출은 **승인 호출과 동일 주기 내에서** 즉시 시도해야 안전.
  비동기 큐로 미루지 말 것.
