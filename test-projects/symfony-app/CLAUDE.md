# Memory — Mindbrain

**Memory is managed by Mindbrain (cloud-persistent). Do NOT use MEMORY.md, auto-memory, or flat files.**

## CRITICAL: Use Mindbrain context FIRST

When answering questions about this project, ALWAYS check your system-reminder for `[Mindbrain — Relevant Memories]` BEFORE exploring files. The memories contain verified project knowledge that is faster and more accurate than re-reading source files.

## Save memories via `mb save`

```bash
# Save a memory (content via stdin)
echo "content" | mb save "Title" -t feedback --tags "tag1,tag2"
```

Types: `user`, `feedback`, `project`, `reference`, `codebase`, `debug`.

**When to save:**
- User corrects your approach → `mb save -t feedback`
- User confirms non-obvious approach → `mb save -t feedback`
- Architecture decision discovered → `mb save -t codebase`
- Project context learned → `mb save -t project`

**DO NOT save to:** `~/.claude/memory/`, `MEMORY.md`, or any flat file. Use `mb save` exclusively.

## Recall memories

```bash
mb search "query"                    # FTS search
mb context -f file1 file2 -t "task"  # contextual recall
mb show <id>                         # full note
```

## Wikilinks

Use `[[Note Title]]` in content to link notes:
```bash
echo "Rate limiter uses [[Auth System]]" | mb save "Rate Limiting" -t codebase
```
