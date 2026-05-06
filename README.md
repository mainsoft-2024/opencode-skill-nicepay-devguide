# opencode-skill-nicepay-devguide

OpenCode / Claude용 스킬. **MCP 번들(`dist/cli.bundle.js`)과 벤더 매뉴얼(`data/manual`) 전부가 `vendor/nicepay-devguide-mcp/`에 포함**됩니다. `mcp-config.json`에 절대 경로를 손댈 필요가 없습니다.

## 설치

```bash
npx -y skills add paulp-o/opencode-skill-nicepay-devguide -g -a opencode -y
```

## 검증

```bash
cd ~/.config/opencode/skills/nicepay-devguide
node pin-mcp-config.cjs   # 클라이언트가 작업 디렉터리를 스킬 폴더로 안 잡을 때
npx -y mcp-to-skill@0.2.2 exec --config ./mcp-config.json --list
```

## 매뉴얼·번들 갱신 (운영자)

모노레포의 `nicepay-devguide-mcp`에서 빌드·동기화한 뒤:

```bash
export NICEPAY_DEVGUIDE_MCP_ROOT=/path/to/nicepay-devguide-mcp
./scripts/refresh-vendor.sh
```

## 라이선스

MIT — 스킬 파일. `data/manual` 내용은 upstream [nicepayments/nicepay-manual](https://github.com/nicepayments/nicepay-manual) 정책을 따릅니다.
