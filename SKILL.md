---
name: nicepay-devguide
description: NICE Payments integration reference for AI agents — quickref-first (Korean), with curated Node/TypeScript code recipes and a fallback search MCP over the official manual repo.
license: MIT
compatibility: opencode
version: 0.4.1
metadata:
  bundled-location: vendor/nicepay-devguide-mcp
  upstream-manual: https://github.com/nicepayments/nicepay-manual
  generator: mcp-to-skill
  generator-repo: https://github.com/larkinwc/ts-mcp-to-skill
  quickref-version: "1.1"
---

# nicepay-devguide

> Two-layer skill. **For coding tasks, read `quickref/INDEX.md` first.**
> The MCP search tools below are a fallback for ad-hoc lookups.

## Layer 1 — `quickref/` (curated Node/TypeScript recipes)

```
quickref/INDEX.md                  ← decision tree + TL;DR (start here)
quickref/signature-formulas.md     ← 6 formulas in one place + helpers
quickref/error-codes.md            ← U312, A211, F100... grouped
quickref/server-approval-card.md   ← end-to-end working TS code
quickref/webhook-intake.md         ← always-200 ack pattern (incl. NICE URL registration dummy)
quickref/recurring-billing.md      ← billing key + cron + retry + grace
quickref/refund-cancel.md          ← cancel · partial refund · 망취소
quickref/preflight-checklist.md    ← console settings · env vars · DB schema · canary
quickref/gotchas.md                ← collected real-world traps
```

These files are **canonical** for our integration patterns. They were
derived from real production debugging where the MCP search and
sample-code tools were insufficient (e.g. signature formula confusion
that caused `U312` and webhook URL registration that failed because
the dummy POST received a 4xx).

If you are an agent integrating NICE for the first time:
1. Read `quickref/INDEX.md`.
2. Pick the recipe that matches your task.
3. Use the search MCP only when the recipe references an unfamiliar
   concept or you need a code that isn't tabulated.

## Layer 2 — Search MCP (`nicepay_devguide_*` tools)

The legacy MCP server clones the
[official nicepay manual](https://github.com/nicepayments/nicepay-manual)
into `nicepay-manual/` (or `$NICEPAY_MANUAL_PATH`) and exposes
search/get-doc tools. Use these for queries the quickref does not
already answer.

| Tool | Purpose | Quickref equivalent (prefer when applicable) |
|---|---|---|
| `nicepay_devguide_search_nicepay_docs` | full-text search the manual | `quickref/error-codes.md`, `quickref/signature-formulas.md` |
| `nicepay_devguide_get_api_endpoint` | endpoint metadata | inline in quickref recipes |
| `nicepay_devguide_get_code_sample` | code samples by topic | curated TS in `quickref/server-approval-card.md` etc. |
| `nicepay_devguide_browse_nicepay_samples` | walk samples by language | rarely needed if quickref has the recipe |
| `nicepay_devguide_get_sdk_method` | JS SDK method shape (esp. requestPay) | `quickref/server-approval-card.md` §1 |

Known retrieval gaps (use grep/webfetch directly when these miss):
- `search_nicepay_docs` may not surface entries from
  `common/code.md` even when the query is an exact result code
  (e.g. `U312`). When this happens, grep the local clone:

  ```bash
  grep -A1 "^| U312 " "$NICEPAY_MANUAL_PATH/common/code.md"
  ```

- `get_code_sample` weights toward Java/Android samples for some
  topics. Use `get_sdk_method("requestPay")` for JS SDK calls.

## Quickstart for a new agent

```
1. Open quickref/INDEX.md
2. If goal = "build server-approval card payment":
     → quickref/server-approval-card.md
     → drop the TS snippets in
3. If a code (Uxxx / Axxx / Fxxx / Pxxx) appears in logs:
     → quickref/error-codes.md
4. If a signature mismatch appears:
     → quickref/signature-formulas.md
5. Before going live:
     → quickref/preflight-checklist.md
```

## Path / runtime issues

- `git` must be on `PATH` for the MCP to clone the manual.
- If the manual already exists locally, set
  `NICEPAY_MANUAL_PATH=/abs/path/to/nicepay-manual`.
- Disable auto-clone: `NICEPAY_MANUAL_AUTOCLONE=0`.
- Force `git pull` on each launch: `NICEPAY_MANUAL_PULL=1`.
- Path resolution issues: `node pin-mcp-config.cjs`.

## Tool listing (machine-readable)

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --list
```

---

*Curated quickref by mad-agent based on production NICE V2 integration
debugging (May 2026). Generator: [mcp-to-skill](https://www.npmjs.com/package/mcp-to-skill).*
