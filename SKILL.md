---
name: nicepay-devguide
description: NICEPAY 개발자 매뉴얼 검색·API·샘플·JS SDK — nicepay-devguide-mcp 0.3.1, live clone github.com/nicepayments/nicepay-manual, 번들만 vendor
license: MIT
compatibility: opencode
metadata:
  bundled-location: vendor/nicepay-devguide-mcp
  upstream-manual: https://github.com/nicepayments/nicepay-manual
  generator: mcp-to-skill
  generator-repo: https://github.com/larkinwc/ts-mcp-to-skill
---

# nicepay-devguide

나이스페이 공식 **GitHub 매뉴얼**([nicepayments/nicepay-manual](https://github.com/nicepayments/nicepay-manual))을 MCP가 **로컬 클론**으로 읽습니다. `vendor/`에는 **번들 JS만** 있고, 매뉴얼은 첫 도구 호출 시 shallow clone(또는 이미 클론된 `NICEPAY_MANUAL_PATH`). **`git`이 PATH에 있어야** 자동 클론이 됩니다.

- 스킬 기본: 옆의 **`nicepay-manual/`** (`.gitignore`).
- **browse_nicepay_samples**: `language` 기준으로 여러 문서에서 코드 펜스를 모아 **구현 참고**용으로 표시.

**경로 문제** 시: `node pin-mcp-config.cjs`

## Available Tools (JSON 인자 키)

- `search_nicepay_docs` — `query`
- `get_api_endpoint` — `endpoint_name`
- `get_code_sample` — `topic`, `language` 또는 **`lang`**
- `browse_nicepay_samples` — **`language`** (필수), `topic` (선택)
- `get_sdk_method` — `method_name`

**클론/오프라인 env** (호스트가 넘겨줄 수 있음): `NICEPAY_MANUAL_PATH`, `NICEPAY_MANUAL_AUTOCLONE=0` (자동 클론 끔), `NICEPAY_MANUAL_PULL=1` (시작 시 `git pull`)

`SKILL_DIR` = 이 디렉터리.

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --list
```

---

*Generator: [mcp-to-skill](https://www.npmjs.com/package/mcp-to-skill).*
