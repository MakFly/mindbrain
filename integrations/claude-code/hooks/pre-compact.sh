#!/bin/bash
# Mindbrain × Claude Code — Pre-Compact Hook
# Saves critical context before conversation compression
# This preserves session learnings that would otherwise be lost

set -euo pipefail

MB="${MB_CLI:-mb}"
MB_CONFIGURED=$($MB show --help 2>/dev/null && echo 1 || echo 0)

if [[ "$MB_CONFIGURED" != "1" ]]; then
  exit 0
fi

# Re-inject feedback rules so they survive compaction
echo "[Mindbrain Feedback Rules — Surviving Compaction]"
$MB search "" --type feedback --limit 20 2>/dev/null || true

echo ""
echo "[Mindbrain Context — Key Memories]"
$MB search "" --type project --limit 5 2>/dev/null || true
