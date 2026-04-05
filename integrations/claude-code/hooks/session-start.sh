#!/bin/bash
# Mindbrain × Claude Code — Session Start Hook
# Injects relevant memories + feedback rules into conversation context
# Install: copy to .claude/hooks/session-start.sh or source from existing hook

set -euo pipefail

MB="${MB_CLI:-mb}"
MB_CONFIGURED=$($MB show --help 2>/dev/null && echo 1 || echo 0)

if [[ "$MB_CONFIGURED" != "1" ]]; then
  exit 0
fi

# 1. Get recent changed files for context
CHANGED_FILES=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null | head -20 | tr '\n' ' ')
fi

# 2. Get current task hint from recent git log
TASK_HINT=$(git log --oneline -1 2>/dev/null || echo "new session")

# 3. Contextual recall — only memories relevant to current work
echo "[Mindbrain Memory]"
if [[ -n "$CHANGED_FILES" ]]; then
  $MB context -f $CHANGED_FILES -t "$TASK_HINT" --limit 10 2>/dev/null || true
else
  $MB context -t "$TASK_HINT" --limit 5 2>/dev/null || true
fi

# 4. Always inject feedback rules (behavioral guidelines)
echo ""
echo "[Mindbrain Feedback Rules]"
$MB search "type:feedback" --type feedback --limit 20 2>/dev/null || true
