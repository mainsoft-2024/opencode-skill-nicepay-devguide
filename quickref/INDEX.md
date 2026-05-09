# nicepay-devguide quickref — START HERE

> Code-first reference. If you are an agent integrating NICE Payments
> from scratch, read this file before calling any `nicepay_devguide_*`
> search tool. The search tools are for ad-hoc lookups; this folder
> is for shipping correct code on the first try.

## When to read what

| Your task | Read this file |
|---|---|
| Build server-approval card payment end-to-end | `server-approval-card.md` |
| Implement webhook intake (dummy-POST safe) | `webhook-intake.md` |
| Build recurring billing (월간/연간 자동 청구) | `recurring-billing.md` |
| Cancel / refund / 망취소 | `refund-cancel.md` |
| Look up an `xNNN` error code (e.g. U312, A211) | `error-codes.md` |
| Compute or verify any signature | `signature-formulas.md` |
| Going live checklist (NICE console settings) | `preflight-checklist.md` |
| Why is my X not working? | `gotchas.md` |

## TL;DR — what you cannot get wrong

1. **Two distinct signatures exist. They use different fields.**
   See `signature-formulas.md`. Conflating them is the #1 cause of
   `U312 SIGN DATA 검증 실패`.

2. **NICE returns HTTP 200 with non-zero `resultCode` for logical errors.**
   Treat `resultCode === "0000"` as the success gate, not the HTTP status.

3. **Webhook URL registration sends a dummy POST to verify your endpoint.**
   Always 200 ack the webhook route. Validate signature internally and
   record the result, but never 4xx the response — see `webhook-intake.md`.

4. **`fnError` is a required callback** in `AUTHNICE.requestPay({...})`.
   Omitting it triggers `필수 파라미터 fnError Funtion 누락되었습니다`.

5. **Server 승인 model** = the merchant server explicitly calls
   `POST /v1/payments/{tid}` after authentication. Without that call the
   payment is not captured. `clientId` prefix `R1_` / `R2_` indicates
   the merchant operates in Server-approval mode.

6. **Basic auth header**: `Basic base64(clientId + ':' + secretKey)`.
   No quotes, no whitespace, no URL-encoding.

7. **secretKey is exactly 32 bytes UTF-8** — used directly as
   AES-256-CBC key for billing-key `encData`. IV = first 16 bytes of
   the same key.

8. **Live mode is enabled per merchant key**. There is no separate
   sandbox URL — `https://api.nicepay.co.kr` is used for both. Whether
   the call is real or test is determined by which `clientId` /
   `secretKey` pair you authenticate with.

9. **Always set the `returnUrl` to your own server-side route**, not
   to a client page. NICE POSTs the result there.

10. **Use the correct flag-on/flag-off semantics for `NICEPAY_MODE`
    in your env**: it gates *your application*'s behaviour
    (e.g. show payment buttons), not NICE's API. NICE's API mode is
    chosen by the credential.
