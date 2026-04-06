# Claude Code Integration Guide

## How it works

Mindbrain hooks into Claude Code's lifecycle via `~/.claude/hooks/`:

```
Session Start → mb context (relevant memories) + mb search (feedback rules)
                    ↓
              Injected into system-reminder via hookSpecificOutput JSON
                    ↓
              Claude sees memories as context (not tool calls = zero token overhead)
                    ↓
During coding → Claude uses mb save to persist new learnings
                    ↓
Pre-Compact → Feedback rules re-injected to survive compression
```

## Install

```bash
cd /path/to/mindbrain
bun run apps/cli/src/index.ts install
```

This:
1. Creates `mb` and `mb-daemon` wrappers in `~/.local/bin/`
2. Copies hook scripts to `~/.mindbrain/hooks/`
3. Injects source blocks into `~/.claude/hooks/session-start.sh` and `pre-compact.sh`
4. Adds `Bash(mb *)` permission to `~/.claude/settings.json`

## Per-Project Setup

```bash
cd ~/your-project
mb init my-project
```

Creates `.mindbrain.json` in the project root:

```json
{
  "projectId": "uuid",
  "apiKey": "mb_xxx"
}
```

Add to `.gitignore`:
```
.mindbrain.json
```

## CLAUDE.md Instructions

Append the Mindbrain snippet to your project's CLAUDE.md:

```bash
cat /path/to/mindbrain/integrations/claude-code/CLAUDE.md.snippet >> CLAUDE.md
```

This tells Claude to:
- Use Mindbrain context FIRST before exploring files
- Use `mb save` instead of auto-memory / MEMORY.md
- Save corrections as feedback notes

## Hook Details

### Session Start

The `session-inject.sh` script is sourced by `session-start.sh`. It:

1. Walks up from `$PWD` to find `.mindbrain.json`
2. Auto-starts the daemon if not running
3. Calls `mb context` with recent git changes + last commit as task hint
4. Calls `mb search --type feedback` for behavioral rules
5. Calls `mb search --type user` for user profile
6. Appends everything to `$MEMORY_OUTPUT` (consumed by the hook's JSON emitter)

### Pre-Compact

The `precompact-inject.sh` script re-injects:
- Feedback rules (behavioral guidelines)
- Project context (current sprint, deadlines)
- User profile

These survive context compression.

## Uninstall

```bash
mb uninstall          # remove hooks and CLI
mb uninstall --purge  # + remove all project configs and database
```

Uses `# ── BEGIN/END MINDBRAIN ──` markers for surgical removal from hooks.

## Token Budget

| Source | Tokens |
|--------|--------|
| Flat files (.claude/) | ~3800 (everything reloaded) |
| Mindbrain | ~250-400 (filtered by relevance) |

The hook strips ANSI colors and formats output as clean text for minimal token usage.
