#!/bin/bash
# Mindbrain session injection — sourced by ~/.claude/hooks/session-start.sh
# Requires: MEMORY_OUTPUT variable to be defined, mb CLI in PATH

MB_CLI="${MINDBRAIN_CLI:-mb}"
command -v "$MB_CLI" &>/dev/null || return 0

# Check if project uses mindbrain (.mindbrain.json walk-up)
_mb_find_config() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    [[ -f "$dir/.mindbrain.json" ]] && return 0
    dir="$(dirname "$dir")"
  done
  return 1
}

_mb_find_config || return 0

# Auto-start daemon if needed
if ! curl -sf http://localhost:${MINDBRAIN_PORT:-3456}/health > /dev/null 2>&1; then
  mb-daemon start > /dev/null 2>&1 || return 0
  sleep 1
fi

curl -sf http://localhost:${MINDBRAIN_PORT:-3456}/health > /dev/null 2>&1 || return 0

_strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }

# Contextual memories
_MB_FILES=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  _MB_FILES=$(git diff --name-only HEAD 2>/dev/null | head -15 | tr '\n' ' ')
fi
_MB_TASK=$(git log --oneline -1 2>/dev/null || echo "new session")

if [[ -n "$_MB_FILES" ]]; then
  _MB_CTX=$($MB_CLI context -f $_MB_FILES -t "$_MB_TASK" --limit 8 2>/dev/null | _strip_ansi || true)
else
  _MB_CTX=$($MB_CLI context -t "$_MB_TASK" --limit 5 2>/dev/null | _strip_ansi || true)
fi
[[ -n "$_MB_CTX" ]] && MEMORY_OUTPUT="${MEMORY_OUTPUT}\n\n[Mindbrain — Relevant Memories]\n${_MB_CTX}"

# Feedback rules
_MB_RULES=$($MB_CLI search "" --type feedback --limit 20 2>/dev/null | _strip_ansi || true)
if [[ -n "$_MB_RULES" ]]; then
  _MB_RULES_CLEAN=$(echo "$_MB_RULES" | grep -v "^ID " | grep -v "^─" | grep -v "result(s)" | sed 's/^[a-f0-9]\{8\}  /- /' | sed '/^$/d')
  [[ -n "$_MB_RULES_CLEAN" ]] && MEMORY_OUTPUT="${MEMORY_OUTPUT}\n\n[Mindbrain — Feedback Rules]\n${_MB_RULES_CLEAN}"
fi

# User profile
_MB_PROFILE=$($MB_CLI search "" --type user --limit 3 2>/dev/null | _strip_ansi || true)
if [[ -n "$_MB_PROFILE" ]]; then
  _MB_PROFILE_CLEAN=$(echo "$_MB_PROFILE" | grep -v "^ID " | grep -v "^─" | grep -v "result(s)" | sed 's/^[a-f0-9]\{8\}  //' | sed '/^$/d')
  [[ -n "$_MB_PROFILE_CLEAN" ]] && MEMORY_OUTPUT="${MEMORY_OUTPUT}\n\n[Mindbrain — User Profile]\n${_MB_PROFILE_CLEAN}"
fi
