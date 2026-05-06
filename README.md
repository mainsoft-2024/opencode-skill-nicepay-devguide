# opencode-skill-nicepay-devguide

OpenCode / Claude용 **Agent Skill** — NICEPAY 개발자 매뉴얼 MCP ([`nicepay-devguide-mcp`](https://github.com/paulp-o/nicepay-devguide-mcp) 번들)을 **`mcp-to-skill`** ([larkinwc/ts-mcp-to-skill](https://github.com/larkinwc/ts-mcp-to-skill))로 감쌉니다.

## toolkit 선택 이유

- npm **`mcp-to-skill`**: MCP에 실제 붙어서 도구 목록을 introspect 함 (`generate` / `exec`).
- 별도 Python 변환기 등 일부 프로젝트는 README와 `SKILL.md` 도구 목록이 **mock**인 경우가 있어, 이 레포는 동작이 확인된 npm 툴을 사용했습니다.

## 설치

1. **MCP 번들**이 필요합니다. [`nicepay-devguide-mcp`](https://github.com/paulp-o/nicepay-devguide-mcp) 저장소를 클론해 `bun install && bun run build` 후 `dist/cli.bundle.js` 경로를 확인합니다.

2. 이 스킬 레포를 클론합니다.

```bash
mkdir -p ~/.config/opencode/skills
git clone https://github.com/paulp-o/opencode-skill-nicepay-devguide.git ~/.config/opencode/skills/nicepay-devguide
```

3. **`mcp-config.json` 수정** — `args[0]`를 1단계에서 나온 `cli.bundle.js` **절대 경로**로 바꿉니다. (`mcp-config.example.json` 참고.)

## 요구 사항

- Node 18+
- 로컬에 빌드된 `nicepay-devguide-mcp/dist/cli.bundle.js`

## MCP 직결

OpenCode `opencode.json`에 동일 MCP를 이미 연결했다면, 이 스킬 없이도 도구를 쓸 수 있습니다. 스킬은 컨텍스트 절약·워크플로 문서화용입니다.

## 라이선스

MIT
