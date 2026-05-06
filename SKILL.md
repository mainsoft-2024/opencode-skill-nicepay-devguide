---
name: nicepay-devguide
description: NICEPAY 개발자 매뉴얼 검색·API·샘플·JS SDK — MCP 번들(cli+data)이 vendor/에 포함, 경로 설정 불필요
license: MIT
compatibility: opencode
metadata:
  bundled-location: vendor/nicepay-devguide-mcp
  upstream-manual: https://github.com/nicepayments/nicepay-manual
  generator: mcp-to-skill
  generator-repo: https://github.com/larkinwc/ts-mcp-to-skill
---

# nicepay-devguide

나이스페이 **공식 개발자 가이드(마크다운)** MCP입니다. `vendor/nicepay-devguide-mcp/`에 **번들 JS + `data/manual`** 이 함께 있어 별도 클론·경로 편집이 필요 없습니다.

- **한국어 검색**: 제목·본문·키워드 매칭을 CJK에 맞게 보강했습니다.
- **get_api_endpoint**: URI 표의 링크/백틱을 벗긴 텍스트와 **Method·Endpoint 열**까지 매칭합니다.
- **get_code_sample**: `language` 외 **`lang` 별칭**, `js`→`javascript` 등 정규화; 언어별 블록이 없으면 전체 블록에서 후보를 씁니다.

**경로:** MCP가 `./launch-devguide.cjs`를 못 찾으면 `node pin-mcp-config.cjs` 실행.

## Available Tools (JSON 인자 키)

- `search_nicepay_docs` — `query` (string)
- `get_api_endpoint` — `endpoint_name` (string, 예: 결제 승인, /v1/payments, POST)
- `get_code_sample` — `topic` (필수), `language` 또는 **별칭 `lang`** (선택, 예: javascript · js · bash)
- `get_sdk_method` — `method_name` (string)

`SKILL_DIR` = 이 디렉터리.

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --list
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --call '{"tool": "search_nicepay_docs", "arguments": {"query": "웹훅"}}'
```

## 매뉴얼 갱신

운영자는 `scripts/refresh-vendor.sh`로 `nicepay-devguide-mcp` 소스 트리에서 `dist`+`data/manual`을 다시 복사할 수 있습니다.

---

*Generator: [mcp-to-skill](https://www.npmjs.com/package/mcp-to-skill).*
