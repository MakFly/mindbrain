# Architecture

## Monorepo Structure

```
mindbrain/
├── apps/
│   ├── api/          # Hono/Bun REST API
│   │   ├── src/
│   │   │   ├── db/         # SQLite + Drizzle + FTS5
│   │   │   ├── routes/     # notes, search, graph, projects
│   │   │   ├── services/   # business logic
│   │   │   └── middleware/  # API key auth
│   │   └── data/           # SQLite database file
│   └── cli/          # mb CLI (commander.js)
│       └── src/
│           ├── commands/    # init, save, search, context, graph, etc.
│           ├── client.ts    # HTTP client to API
│           └── config.ts    # .mindbrain.json resolution
├── packages/
│   └── shared/       # Types + Zod validators
├── integrations/
│   └── claude-code/  # Hooks, install scripts, CLAUDE.md template
├── scripts/
│   └── daemon.sh     # API daemon management
└── tests/
    └── e2e/          # 10 test suites + HTML report
```

## Key Decisions

### SQLite + FTS5 (not Postgres/pgvector)

Zero infrastructure. One file. FTS5 provides full-text search with BM25 ranking. Sufficient for MVP — vector search planned for wave 2.

### bun:sqlite (not better-sqlite3)

Zero dependency, native Bun performance. `better-sqlite3` only needed for drizzle-kit CLI.

### Raw SQL for FTS5

Drizzle ORM doesn't support FTS5 virtual tables or MATCH queries. FTS5 setup (virtual table + triggers) uses raw SQL. Regular CRUD uses Drizzle.

### OR mode for FTS5

Search terms are joined with OR: `"fix" OR "rate" OR "limiting"`. More forgiving than AND — matches notes containing any term.

### Per-project .mindbrain.json (not global config)

The CLI walks up the filesystem from `$PWD` to find `.mindbrain.json` (like git finds `.git/`). Each project has its own API key → complete isolation.

### Hook injection via source (not inline code)

Mindbrain injects a single `source` line into Claude Code's hooks, between `# ── BEGIN/END MINDBRAIN ──` markers. The actual logic lives in `~/.mindbrain/hooks/`. Benefits:
- Clean install/uninstall (add/remove 3 lines)
- Updates don't require re-editing hooks
- No risk of breaking existing hook logic

### hookSpecificOutput JSON format

Claude Code hooks communicate via JSON on stdout:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "suppressOutput": true,
    "additionalContext": "...injected into system-reminder..."
  }
}
```

Only ONE hook per event can emit this JSON. Mindbrain appends to the existing hook's `$MEMORY_OUTPUT` variable, so both flat-file memory and Mindbrain memories are emitted in a single JSON.

## Data Model

```
Project 1──N Note
Note    1──N Edge (source)
Note    0──N Edge (target, nullable for dangling wikilinks)

Note {
  id, projectId, title, content, type, tags (JSON), metadata (JSON),
  createdAt, updatedAt
}

Edge {
  id, sourceId, targetId (nullable), type, label, createdAt
}

notes_fts (FTS5 virtual table) {
  title, content, tags — synced via triggers
}
```

## Context Search Algorithm

1. FTS5 MATCH on task description → top 50 candidates
2. Score each: `(-BM25rank * fileBoost) + recencyBoost`
   - fileBoost: x2 if `metadata.files` intersects request files
   - recencyBoost: `1 / (1 + daysOld / 30)`
3. Filter by tags/type if provided
4. Return top N formatted as markdown

## Security

- API keys: `mb_` + 32 random hex, stored as SHA-256 hash
- Per-project isolation: all queries filter by projectId from authenticated key
- `.mindbrain.json` contains the API key → must be in `.gitignore`
