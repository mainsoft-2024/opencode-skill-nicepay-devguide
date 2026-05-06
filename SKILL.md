---
name: nicepay-devguide
description: NICEPAY 개발자 매뉴얼(md) 검색·엔드포인트·코드샘플·JS SDK — vendored nicepay-devguide-mcp 번들 경로 필요
license: MIT
compatibility: opencode
metadata:
  upstream-manual: https://github.com/nicepayments/nicepay-manual
  generator: mcp-to-skill
  generator-repo: https://github.com/larkinwc/ts-mcp-to-skill
  toolkit-npm: mcp-to-skill
---

# nicepay-devguide

나이스페이 **공식 개발자 가이드(마크다운)** 를 검색·조회하는 MCP 도구입니다. MCP 전체가 아니라 이 스킬 + `mcp-to-skill exec`로 필요 시에만 호출합니다.

**사전 준비:** `mcp-config.json`의 `args[0]`를 로컬의 `nicepay-devguide-mcp/dist/cli.bundle.js` **절대 경로**로 바꿉니다. (`mcp-config.example.json` 참고.)

## Available Tools

- `search_nicepay_docs(query*)`: 매뉴얼 키워드 검색
- `get_api_endpoint(endpoint_name*)`: API 엔드포인트 상세
- `get_code_sample(topic*, language?)`: 예시 코드
- `get_sdk_method(method_name*)`: JS SDK 메서드 (예: AUTHNICE.requestPay)

## 실행

`SKILL_DIR` = 이 폴더의 절대 경로.

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --call '{"tool": "search_nicepay_docs", "arguments": {"query": "웹훅"}}'
```

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --list
```

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --describe get_api_endpoint
```

## 번들 준비

[`nicepay-devguide-mcp`](https://github.com/paulp-o/nicepay-devguide-mcp) 저장소를 클론한 뒤:

```bash
cd nicepay-devguide-mcp && bun install && bun run build
```

생성된 `dist/cli.bundle.js` 경로를 `mcp-config.json`에 넣습니다.

## Regenerate

```bash
npx -y mcp-to-skill@0.2.2 generate --mcp-config mcp-config.json --output-dir /tmp/regen
```

(경로가 올바를 때만 introspect가 됩니다.)

---

*Generator: [mcp-to-skill](https://www.npmjs.com/package/mcp-to-skill).*
