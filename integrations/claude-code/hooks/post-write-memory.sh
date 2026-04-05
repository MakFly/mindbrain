#!/bin/bash
# Mindbrain × Claude Code — Post-Write Hook (memory sync)
# When Claude writes to .claude/memory/ or rules/, sync to Mindbrain
# Install as post-tool hook filtering on Write tool

set -euo pipefail

MB="${MB_CLI:-mb}"
FILE="${CLAUDE_TOOL_FILE:-}"

# Only trigger on memory-related writes
if [[ -z "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  */memory/*.md|*/rules/memory/*.md)
    ;;
  *)
    exit 0
    ;;
esac

# Parse frontmatter from the written file
if [[ ! -f "$FILE" ]]; then
  exit 0
fi

TITLE=$(grep -m1 "^name:" "$FILE" 2>/dev/null | sed 's/^name:[[:space:]]*//' || basename "$FILE" .md)
TYPE=$(grep -m1 "^type:" "$FILE" 2>/dev/null | sed 's/^type:[[:space:]]*//' || echo "feedback")

# Map to valid mindbrain types
case "$TYPE" in
  user|feedback|project|reference|codebase|debug) ;;
  *) TYPE="feedback" ;;
esac

# Extract tags from description if present
TAGS=""
DESC=$(grep -m1 "^description:" "$FILE" 2>/dev/null | sed 's/^description:[[:space:]]*//' || echo "")
if [[ -n "$DESC" ]]; then
  TAGS="auto-sync"
fi

# Save to Mindbrain (skip frontmatter, send body only)
BODY=$(sed -n '/^---$/,/^---$/d; p' "$FILE" 2>/dev/null || cat "$FILE")

if [[ -n "$BODY" && -n "$TITLE" ]]; then
  echo "$BODY" | $MB save "$TITLE" -t "$TYPE" --tags "${TAGS:-auto-sync}" 2>/dev/null || true
fi
