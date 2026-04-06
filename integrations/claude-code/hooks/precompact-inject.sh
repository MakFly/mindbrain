#!/bin/bash
# Mindbrain pre-compact injection — sourced by ~/.claude/hooks/pre-compact.sh
MB_CLI="${MINDBRAIN_CLI:-mb}"
command -v "$MB_CLI" &>/dev/null || return 0

_mb_find_config() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    [[ -f "$dir/.mindbrain.json" ]] && return 0
    dir="$(dirname "$dir")"
  done
  return 1
}

_mb_find_config || return 0
curl -sf http://localhost:${MINDBRAIN_PORT:-3456}/health > /dev/null 2>&1 || return 0

_strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }

_MB_RULES=$($MB_CLI search "" --type feedback --limit 15 2>/dev/null | _strip_ansi || true)
if [[ -n "$_MB_RULES" ]]; then
  _MB_RULES_CLEAN=$(echo "$_MB_RULES" | grep -v "^ID " | grep -v "^─" | grep -v "result(s)" | sed 's/^[a-f0-9]\{8\}  /- /' | sed '/^$/d')
  [[ -n "$_MB_RULES_CLEAN" ]] && COMPACT_CTX="${COMPACT_CTX}\n\n[Mindbrain — Feedback Rules]\n${_MB_RULES_CLEAN}"
fi

_MB_PROJECT=$($MB_CLI search "" --type project --limit 5 2>/dev/null | _strip_ansi || true)
if [[ -n "$_MB_PROJECT" ]]; then
  _MB_PROJECT_CLEAN=$(echo "$_MB_PROJECT" | grep -v "^ID " | grep -v "^─" | grep -v "result(s)" | sed 's/^[a-f0-9]\{8\}  /- /' | sed '/^$/d')
  [[ -n "$_MB_PROJECT_CLEAN" ]] && COMPACT_CTX="${COMPACT_CTX}\n\n[Mindbrain — Project Context]\n${_MB_PROJECT_CLEAN}"
fi

_MB_PROFILE=$($MB_CLI search "" --type user --limit 3 2>/dev/null | _strip_ansi || true)
if [[ -n "$_MB_PROFILE" ]]; then
  _MB_PROFILE_CLEAN=$(echo "$_MB_PROFILE" | grep -v "^ID " | grep -v "^─" | grep -v "result(s)" | sed 's/^[a-f0-9]\{8\}  //' | sed '/^$/d')
  [[ -n "$_MB_PROFILE_CLEAN" ]] && COMPACT_CTX="${COMPACT_CTX}\n\n[Mindbrain — User Profile]\n${_MB_PROFILE_CLEAN}"
fi
