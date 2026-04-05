#!/bin/bash
# Mindbrain × Claude Code — Installation script
# Usage: bash install.sh
set -euo pipefail

BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"
GREEN="\033[32m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/hooks"
CLAUDE_DIR="${HOME}/.claude"

echo -e "${BOLD}Mindbrain × Claude Code Integration${RESET}\n"

# 1. Check mb CLI is available
if ! command -v mb &>/dev/null; then
  # Try bun global link
  MINDBRAIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  echo -e "${DIM}mb CLI not in PATH. Linking from $MINDBRAIN_ROOT...${RESET}"
  cd "$MINDBRAIN_ROOT" && bun link 2>/dev/null || true

  if ! command -v mb &>/dev/null; then
    echo "Error: mb CLI not found. Run 'bun link' in the mindbrain root first."
    exit 1
  fi
fi

echo -e "${GREEN}✓${RESET} mb CLI found"

# 2. Check mindbrain is initialized
if [[ ! -f "${HOME}/.mindbrain/config.json" ]]; then
  echo -e "${DIM}No mindbrain config found. Initializing...${RESET}"
  mb init "$(basename "$(pwd)")" --path "$(pwd)"
fi

echo -e "${GREEN}✓${RESET} Mindbrain configured"

# 3. Make hooks executable
chmod +x "$HOOKS_DIR"/*.sh
echo -e "${GREEN}✓${RESET} Hooks executable"

# 4. Show integration instructions
echo -e "\n${BOLD}Setup Instructions${RESET}\n"

echo -e "1. Add hooks to your ${BOLD}.claude/settings.json${RESET}:"
echo ""
cat <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bash $HOOKS_DIR/session-start.sh"
      }
    ],
    "PreCompact": [
      {
        "type": "command",
        "command": "bash $HOOKS_DIR/pre-compact.sh"
      }
    ]
  }
}
EOF

echo -e "\n2. Add memory instructions to your ${BOLD}CLAUDE.md${RESET}:"
echo -e "   ${DIM}See: $SCRIPT_DIR/CLAUDE.md.example${RESET}"

echo -e "\n3. Import existing memories (optional):"
echo -e "   ${DIM}mb import ~/.claude/projects/<your-project>/memory/${RESET}"

echo -e "\n${GREEN}${BOLD}Done!${RESET} Mindbrain will auto-recall on session start and persist across compactions."
