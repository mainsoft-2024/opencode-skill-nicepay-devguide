# NICE result codes — searchable by code or by symptom

> The full table lives in `nicepay-manual/common/code.md`. This file
> reorganises the codes that agents most often hit while building an
> integration, with **diagnosis + fix** for each. If you need a code
> not listed here, grep `nicepay-manual/common/code.md` directly —
> the local clone is at `$NICEPAY_MANUAL_PATH` (default:
> `<skill-dir>/nicepay-manual`).

## Quick lookup index

| Code | Meaning | First thing to check |
|---|---|---|
| `0000` | 결제성공 | n/a |
| `2001` | 취소 성공 | n/a |
| `2014` | 취소 불가능 거래 | 이미 취소된 건이거나 취소 가능 시한 초과 |
| `2016` | 취소 기한 초과 | 결제일 기준 취소 가능 일수 초과 |
| `3011` | 카드번호 오류 | 사용자 입력 오류 — UI에서 안내 |
| `3041` | 1000원 미만 신용카드 승인 불가 | 최소 결제액 1000원 |
| `A115` | TID가 유효하지 않습니다 | 잘못된 tid 또는 인증 만료 (30분) |
| `A123` | 거래금액 불일치 | 인증 amount ≠ 승인 amount |
| `A211` | 해쉬값 검증에 실패하였습니다 | signData 잘못 계산 — `signature-formulas.md` 확인 |
| `A224` | 허용되지 않은 IP입니다 | NICE 콘솔 IP 화이트리스트에 서버 IP 추가 |
| `A225` | TID 중복 오류 | 같은 tid로 두 번 승인 시도 — 멱등성 필요 |
| `A245` | 인증 시간이 초과 되었습니다 | 결제창 인증 후 30분 이내 승인 필요 |
| **`U304`** | **BASIC AUTHENTICATION 실패** | `Authorization: Basic` 헤더 잘못. `clientId:secretKey` base64 확인 |
| **`U305`** | **BEARER AUTHENTICATION 실패** | Bearer 토큰 만료/오류 |
| `U306` | 전자서명 및 암호화메시지 검증 실패 | encData 암호화 잘못 (AES-256-CBC 키/IV 확인) |
| `U310` | SIGN DATA 생성에 실패하였습니다 | NICE 측에서 signData 생성 실패 — 재시도 |
| `U311` | 인증이 취소되었거나 실패하였습니다 | 사용자가 결제창에서 취소 |
| **`U312`** | **SIGN DATA 검증에 실패하였습니다** | **본문 signData 공식 잘못. `signature-formulas.md` (2)번 확인.** 가장 흔한 실수: returnUrl 공식을 본문에 사용 |
| `U313` | 상점 MID가 유효하지 않습니다 | clientId 오타 또는 가맹점 비활성 |
| `U315` | 허용되지 않은 IP 입니다 | 콘솔 IP 화이트리스트 |
| `U316` | 상점 기준정보가 유효하지 않습니다 | 가맹점 계약 정보 미설정 — NICE 가맹점 관리 확인 |
| `F100` | 빌키가 정상적으로 생성되었습니다 | 성공 (실패 아님) |
| `F102` | 인증서 검증 오류 | 빌링키 발급 인증서 문제 |
| `F112` | 유효하지 않은 카드번호 (card_bin 없음) | encData 평문의 cardNo 형식 확인 |
| `F115` | 빌키 발급 불가 가맹점입니다 (중지) | 가맹점 정기결제 권한 없음 — 영업 담당 문의 |
| `F201` | 이미 등록된 카드 입니다 (빌키발급실패) | 동일 카드 중복 빌링키 — 기존 빌키 재사용 |
| `P007` | 필수 파라미터 {param}가 없습니다 | 본문에 명시된 필수 필드 누락 |
| `P015` | orderid {}가 이미 존재합니다 | 같은 orderId 재사용 시도 — 새 orderId 발급 |
| `P017` | 결제금액은 0원 결제가 불가합니다 | 최소 1원 이상 |
| `P027` | 원격 실패(MCI) | 카드사 측 일시 장애 — 재시도 |
| `P037` | 5만원 미만인 경우 할부 지정이 불가 합니다 | cardQuota="00" (일시불) 사용 |

## By category

### 인증/시그니처 (U3xx, A2xx)
- `U304`/`U305` — auth header malformed
- `U306` — encData decrypt failed
- `U310`/`U311`/`U312` — signData related (생성/취소/검증)
- `A211` — hash 검증 실패 (signData와 동일 카테고리)
- `A245` — 인증 만료 (30분 초과)

### 거래 정합성 (A1xx, P0xx)
- `A115` — invalid tid
- `A123` — amount mismatch (인증 amount와 다름)
- `A225` — tid duplicate
- `P015` — orderId duplicate
- `P017` — zero amount

### 카드 (3xxx)
- `3011`–`3014` — card number / merchant card config
- `3021`–`3024` — expiry / installment
- `3041` — 최소 1000원 미만
- `3052`–`3057` — 해외카드 / 통화

### 가상계좌 (4xxx)
- `4100`/`4110` — 발급 / 입금 성공
- `4101`–`4127` — 발급/입금 실패 다양

### 빌링 (Fxxx)
- `F100`/`F101` — 빌키 생성/삭제 성공
- `F102`–`F118` — 빌키 발급 실패
- `F200`/`F201` — 빌링 승인 / 중복 카드

### 망취소 / 취소 (2xxx)
- `2001` — 취소 성공
- `2010`–`2033` — 취소 사유별 실패
- `2020` — 망취소 시간 초과 (typically 5분)

## Reading the full table

```bash
cat $NICEPAY_MANUAL_PATH/common/code.md     # full canonical list
grep -A1 "^| U312 " $NICEPAY_MANUAL_PATH/common/code.md
```

If the search MCP `nicepay_devguide_search_nicepay_docs` does not find
a code (known indexing gap), grep the markdown directly.
