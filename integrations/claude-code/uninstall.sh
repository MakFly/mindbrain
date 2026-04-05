#!/bin/bash
# Mindbrain × Claude Code — Uninstall script
# Removes mindbrain hooks from Claude Code settings
set -euo pipefail

BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"
RED="\033[31m"
GREEN="\033[32m"

CLAUDE_SETTINGS="${HOME}/.claude/settings.json"

echo -e "${BOLD}Mindbrain × Claude Code — Uninstall${RESET}\n"

# 1. Remove hooks from settings.json if present
if [[ -f "$CLAUDE_SETTINGS" ]]; then
  if command -v bun &>/dev/null; then
    bun -e "
      const fs = require('fs');
      const path = '$CLAUDE_SETTINGS';
      const settings = JSON.parse(fs.readFileSync(path, 'utf8'));

      if (settings.hooks) {
        let changed = false;

        for (const [event, hooks] of Object.entries(settings.hooks)) {
          if (Array.isArray(hooks)) {
            const filtered = hooks.filter(h => !h.command?.includes('mindbrain'));
            if (filtered.length !== hooks.length) {
              changed = true;
              if (filtered.length === 0) {
                delete settings.hooks[event];
              } else {
                settings.hooks[event] = filtered;
              }
            }
          }
        }

        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }

        if (changed) {
          fs.writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
          console.log('✓ Removed mindbrain hooks from settings.json');
        } else {
          console.log('ℹ No mindbrain hooks found in settings.json');
        }
      } else {
        console.log('ℹ No hooks section in settings.json');
      }
    "
  else
    echo -e "${RED}bun not found — remove mindbrain hooks manually from $CLAUDE_SETTINGS${RESET}"
  fi
else
  echo -e "${DIM}No settings.json found at $CLAUDE_SETTINGS${RESET}"
fi

# 2. Optionally remove config
echo ""
read -p "Remove ~/.mindbrain/ config? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "${HOME}/.mindbrain"
  echo -e "${GREEN}✓${RESET} Removed ~/.mindbrain/"
else
  echo -e "${DIM}Kept ~/.mindbrain/ config${RESET}"
fi

echo -e "\n${GREEN}${BOLD}Uninstalled.${RESET} Mindbrain hooks removed from Claude Code."
echo -e "${DIM}The mindbrain API/CLI are still available — only the Claude Code integration was removed.${RESET}"
