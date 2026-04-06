# CLI Reference

## Global

```bash
mb --version    # 0.1.0
mb --help       # list all commands
```

## Setup

### `mb install`

Install Mindbrain integration into Claude Code.

```bash
mb install
```

Creates:
- `~/.local/bin/mb` and `~/.local/bin/mb-daemon` wrappers
- `~/.mindbrain/hooks/` with injection scripts
- Injects `# BEGIN/END MINDBRAIN` blocks into `~/.claude/hooks/session-start.sh` and `pre-compact.sh`
- Adds `Bash(mb *)` permission to `~/.claude/settings.json`

Idempotent — safe to run multiple times.

### `mb uninstall`

Remove Mindbrain integration from Claude Code.

```bash
mb uninstall          # interactive confirmations
mb uninstall -y       # skip confirmations
mb uninstall --purge  # also remove .mindbrain.json files and API database
```

### `mb init [name]`

Initialize Mindbrain for a project. Creates `.mindbrain.json` in the current directory.

```bash
cd ~/projects/my-app
mb init my-app
mb init my-app --path /custom/path
mb init --api-url https://mindbrain.example.com
```

## Notes

### `mb save <title>`

Save a note.

```bash
# Content from stdin
echo "JWT auth in src/Security/" | mb save "Auth System" -t codebase --tags "auth,security"

# Content from file
mb save "Architecture" -t codebase -f docs/arch.md --tags "docs"

# With metadata (JSON)
mb save "Rate Limiter" -t codebase --tags "perf" -m '{"files":["src/RateLimiter.php"]}'
```

**Options:**
| Flag | Required | Description |
|------|----------|-------------|
| `-t, --type` | Yes | `user`, `feedback`, `project`, `reference`, `codebase`, `debug` |
| `--tags` | No | Comma-separated tags |
| `-f, --file` | No | Read content from file |
| `-m, --meta` | No | JSON metadata string |

### `mb show <id>`

Display a note. Accepts full UUID or short prefix (8+ chars).

```bash
mb show 0f5da8e1
```

### `mb edit <id>`

Open a note in `$EDITOR` for editing.

```bash
mb edit 0f5da8e1
```

### `mb rm <id>`

Delete a note.

```bash
mb rm 0f5da8e1          # asks confirmation
mb rm 0f5da8e1 --force  # no confirmation
```

## Search

### `mb search <query>`

Full-text search with FTS5 (OR mode between terms).

```bash
mb search "auth"
mb search "fix rate limiting" --type codebase
mb search "auth" --tags "security" --limit 10
```

### `mb context`

Contextual recall — the killer feature. Returns the most relevant memories for your current files and task.

```bash
mb context -f src/auth.ts src/middleware.ts -t "fix login bug"
mb context -t "add rate limiting" --limit 5
```

Output is formatted markdown, injectable into AI agent context.

## Graph

### `mb graph [noteId]`

Display the knowledge graph as ASCII tree.

```bash
mb graph              # full project graph
mb graph 0f5da8e1 -d 3  # sub-graph, depth 3
```

### `mb links <id>`

Show backlinks — notes pointing to this note.

```bash
mb links 0f5da8e1
```

## Import / Export

### `mb import [dir]`

Import notes from a directory of markdown files with frontmatter.

```bash
mb import                          # default: .claude/memory/
mb import ~/.claude/projects/*/memory/
```

### `mb export [dir]`

Export all notes as markdown files with frontmatter.

```bash
mb export                    # default: ./mindbrain-export/
mb export ~/backup/memories/
```

## Daemon

```bash
mb-daemon start    # start API server (port 3456)
mb-daemon stop     # stop
mb-daemon restart  # restart
mb-daemon status   # show PID, port, uptime
mb-daemon logs     # tail logs
```

PID: `~/.mindbrain/daemon.pid` — Logs: `~/.mindbrain/daemon.log`
