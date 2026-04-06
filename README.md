# Mindbrain

Persistent cloud memory for AI coding agents. Notes, wikilinks, full-text search, contextual recall — injected automatically into your Claude Code sessions.

```
mb init                          # init project
mb save "Auth flow" -t codebase  # save a memory
mb search "auth"                 # full-text search
mb context -f src/auth.ts -t "fix login"  # contextual recall
mb graph                         # knowledge graph
```

## Why

AI coding assistants (Claude Code, Cursor, Codex) reload everything from scratch every session. Flat files in `.claude/` don't scale, can't search semantically, and are lost during context compaction.

Mindbrain fixes this: a **cloud-persistent memory** with FTS5 search, wikilinks between notes, and contextual recall that injects only what's relevant — ~300 tokens instead of ~4000.

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐
│  Claude Code │────▶│  mb CLI  │────▶│  Hono API    │
│  (hooks)     │     │          │     │  :3456       │
└─────────────┘     └──────────┘     ├──────────────┤
                                      │  SQLite      │
                                      │  + FTS5      │
                                      └──────────────┘
```

- **API** — Hono/Bun, SQLite + FTS5, Drizzle ORM
- **CLI** — `mb` command, commander.js
- **Hooks** — auto-inject memories at session start, survive compaction
- **Per-project** — `.mindbrain.json` per project, full isolation

## Quick Start

```bash
# 1. Clone & install
git clone git@github.com:MakFly/mindbrain.git
cd mindbrain
bun install

# 2. Install (hooks, CLI, permissions)
bun run apps/cli/src/index.ts install

# 3. Start daemon
mb-daemon start

# 4. Init your project
cd ~/your-project
mb init my-project

# 5. Add memory instructions to your project
cat /path/to/mindbrain/integrations/claude-code/CLAUDE.md.snippet >> CLAUDE.md
```

## Documentation

| Doc | Description |
|-----|-------------|
| [CLI Reference](docs/cli.md) | All commands and options |
| [API Reference](docs/api.md) | REST endpoints |
| [Integration Guide](docs/integration.md) | Claude Code hooks setup |
| [Architecture](docs/architecture.md) | Technical design decisions |

## Uninstall

```bash
mb uninstall          # remove hooks, permissions, CLI wrappers
mb uninstall --purge  # + remove all .mindbrain.json and database
```

## Roadmap

- [x] Wave 1 — API + CLI + SQLite/FTS5
- [x] Wave 1.5 — Claude Code hooks integration
- [ ] Wave 2 — Vector search (sqlite-vec), MCP server
- [ ] Wave 3 — Next.js dashboard, graph visualizer, AST-awareness

## License

Private — MakFly
