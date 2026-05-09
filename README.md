> ## ⚡ TL;DR for AI agents
>
> Read **`quickref/INDEX.md`** before doing any NICE Payments coding.
> The MCP search tools are a fallback for the cases the curated quickref
> doesn't already cover. The quickref folder contains battle-tested
> Node/TypeScript recipes for: server-approval card, webhook intake,
> recurring billing, refund/cancel, signature formulas, error code
> lookup, and a pre-launch checklist.
>
> Quickref index:
> - `quickref/INDEX.md` — decision tree
> - `quickref/signature-formulas.md` — 6 formulas, all in one place
> - `quickref/error-codes.md` — U312, A211, F100... grouped & explained
> - `quickref/server-approval-card.md` — end-to-end TS recipe
> - `quickref/webhook-intake.md` — always-200 ack pattern
> - `quickref/recurring-billing.md` — billing key + cron
> - `quickref/refund-cancel.md` — cancel · partial refund · 망취소
> - `quickref/preflight-checklist.md` — go-live checklist
> - `quickref/gotchas.md` — collected real-world traps

---

# opencode-skill-nicepay-devguide

OpenCode용 스킬. **MCP 번들**(`vendor/nicepay-devguide-mcp/dist/cli.bundle.js`)만 포함합니다. 매뉴얼 본문은 **첫 실행 시** [nicepayments/nicepay-manual](https://github.com/nicepayments/nicepay-manual) 을 `git clone` 으로 받습니다 (`git` 필요).

- 기본 클론 위치: 스킬 옆 **`nicepay-manual/`** (`launch-devguide.cjs` 가 `NICEPAY_MANUAL_PATH` 로 넘김). `.gitignore`에 있어 저장소에는 안 올라감.
- 덮어쓰기: 환경 변수 **`NICEPAY_MANUAL_PATH`** 로 다른 디렉터리 지정.
- 오프라인: 같은 변수로 이미 클론해 둔 경로를 가리키거나, MCP 패키지에 `data/manual` 이 있으면 폴백(선택).

## 설치

```bash
npx -y skills add mainsoft-2024/opencode-skill-nicepay-devguide -g -a opencode -y
```

## 수동 클론 (선택)

```bash
cd ~/.config/opencode/skills/nicepay-devguide   # 설치 경로
git clone --depth 1 https://github.com/nicepayments/nicepay-manual.git nicepay-manual
```

## 검증

```bash
cd ~/.config/opencode/skills/nicepay-devguide
node pin-mcp-config.cjs   # MCP가 상대 경로 실패 시
npx -y mcp-to-skill@0.2.2 exec --config ./mcp-config.json --list
```

## 번들만 갱신 (운영자)

```bash
export NICEPAY_DEVGUIDE_MCP_ROOT=/path/to/nicepay-devguide-mcp   # 빌드된 모듈
./scripts/refresh-vendor.sh
```

## 라이선스

MIT — 스킬 파일. 매뉴얼 내용은 upstream 정책을 따릅니다.
