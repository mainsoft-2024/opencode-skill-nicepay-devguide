#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${NICEPAY_DEVGUIDE_MCP_ROOT:-}"
if [[ -z "$SRC" || ! -f "$SRC/dist/cli.bundle.js" ]]; then
  echo "Set NICEPAY_DEVGUIDE_MCP_ROOT to a built nicepay-devguide-mcp repo (dist/cli.bundle.js)." >&2
  exit 1
fi
mkdir -p "$ROOT/vendor/nicepay-devguide-mcp/dist"
cp "$SRC/dist/cli.bundle.js" "$ROOT/vendor/nicepay-devguide-mcp/dist/cli.bundle.js"
node "$ROOT/pin-mcp-config.cjs" || true
echo "OK: vendor bundle synced from $SRC (manual comes from GitHub clone at runtime)"
