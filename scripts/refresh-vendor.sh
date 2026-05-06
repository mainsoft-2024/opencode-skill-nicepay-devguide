#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${NICEPAY_DEVGUIDE_MCP_ROOT:-}"
if [[ -z "$SRC" || ! -f "$SRC/dist/cli.bundle.js" ]]; then
  echo "Set NICEPAY_DEVGUIDE_MCP_ROOT to a built nicepay-devguide-mcp repo (with dist/cli.bundle.js and data/manual)." >&2
  exit 1
fi
mkdir -p "$ROOT/vendor/nicepay-devguide-mcp/dist"
cp "$SRC/dist/cli.bundle.js" "$ROOT/vendor/nicepay-devguide-mcp/dist/cli.bundle.js"
rsync -a --delete "$SRC/data/manual" "$ROOT/vendor/nicepay-devguide-mcp/data/"
echo "OK: vendor synced from $SRC"
