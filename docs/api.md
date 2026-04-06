# API Reference

Base URL: `http://localhost:3456`

Auth: `X-API-Key: mb_xxx` header on all endpoints except `POST /projects` and `GET /health`.

## Health

```
GET /health → { status: "ok" }
```

## Projects

### Create Project

```
POST /projects
Body: { name: string, path?: string }
→ 201 { project: { id, name, path, createdAt }, apiKey: "mb_xxx" }
```

The API key is shown **once** — save it.

### Project Stats

```
GET /projects/:id/stats
→ { noteCount, edgeCount, tagCount }
```

## Notes

### Create Note

```
POST /notes
Body: { title: string, content: string, type: NoteType, tags?: string[], metadata?: object }
→ 201 { id, projectId, title, content, type, tags, metadata, createdAt, updatedAt }
```

Wikilinks (`[[Other Note]]`) in content are auto-parsed into edges.

### List Notes

```
GET /notes?type=&tags=&limit=50&offset=0
→ [Note, ...]
```

### Get Note

```
GET /notes/:id
→ { ...Note, backlinkCount }
```

Accepts short ID prefix (8+ chars).

### Update Note

```
PUT /notes/:id
Body: { title?, content?, type?, tags?, metadata? }
→ Note
```

Wikilinks are re-synced on content change.

### Delete Note

```
DELETE /notes/:id → 204
```

## Search

### Full-Text Search

```
GET /search?q=auth&tags=security&type=codebase&limit=20&offset=0
→ { results: [{ ...Note, rank }], count }
```

FTS5 with BM25 ranking. OR mode between terms.

Empty `q` returns notes filtered by type/tags only.

### Context Search

```
POST /search/context
Body: { files: string[], task: string, tags?: string[], type?: NoteType, limit?: number }
→ { notes: ScoredNote[], markdown: string, count }
```

Scoring algorithm:
1. FTS5 on task → top 50
2. File boost: x2 if note's `metadata.files` intersects request files
3. Recency boost: `1 / (1 + daysOld / 30)`
4. Sort by score, return top N

## Graph

### Get Graph

```
GET /graph?noteId=xxx&depth=2
→ { nodes: Note[], edges: Edge[] }
```

If `noteId`: BFS sub-graph. If omitted: full project graph.

### Backlinks

```
GET /graph/notes/:id/backlinks
→ [{ note: Note, edge: { id, type, label } }]
```

### Create Link

```
POST /graph/notes/:id/link
Body: { targetId: string, type?: EdgeType }
→ Edge
```

## Types

```typescript
type NoteType = "user" | "feedback" | "project" | "reference" | "codebase" | "debug"
type EdgeType = "wikilink" | "tag" | "related" | "blocks"
```
