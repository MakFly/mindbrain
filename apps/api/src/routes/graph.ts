import { Hono } from "hono";
import { createLinkSchema } from "@mindbrain/shared";
import type { AppEnv } from "../types";
import {
  getSubGraph,
  getFullGraph,
  getBacklinks,
  createLink,
} from "../services/graph";

const app = new Hono<AppEnv>();

// GET / — sub-graph or full project graph
app.get("/", async (c) => {
  const projectId = c.get("projectId");
  const noteId = c.req.query("noteId");
  const depth = c.req.query("depth") ? Number(c.req.query("depth")) : 2;

  if (depth < 1 || depth > 10) {
    return c.json({ error: "depth must be between 1 and 10" }, 400);
  }

  if (noteId) {
    const graph = getSubGraph(noteId, depth);
    return c.json(graph);
  }

  const graph = await getFullGraph(projectId);
  return c.json(graph);
});

// GET /notes/:id/backlinks
app.get("/notes/:id/backlinks", (c) => {
  const noteId = c.req.param("id");
  const backlinks = getBacklinks(noteId);
  return c.json({ backlinks, count: backlinks.length });
});

// POST /notes/:id/link — create a link from this note to another
app.post("/notes/:id/link", async (c) => {
  const sourceId = c.req.param("id");
  const body = await c.req.json();

  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { targetId, type } = parsed.data;
  const edge = await createLink(sourceId, targetId, type);

  return c.json({ edge }, 201);
});

// POST /auto-link — generate edges between related notes using FTS5 cross-matching
app.post("/auto-link", async (c) => {
  const projectId = c.get("projectId");
  const { sqlite } = await import("../db");
  const { edges: edgesTable } = await import("../db/schema");
  const { db: drizzle } = await import("../db");

  // Get all notes for this project
  const allNotes = sqlite
    .query<{ id: string; title: string; type: string; tags: string }, [string]>(
      "SELECT id, title, type, tags FROM notes WHERE project_id = ?1"
    )
    .all(projectId);

  if (allNotes.length === 0) {
    return c.json({ created: 0, message: "No notes found" });
  }

  // Build existing edge set to avoid duplicates
  const existingEdges = new Set<string>();
  const existingRows = sqlite
    .query<{ source_id: string; target_id: string }, [string]>(
      `SELECT source_id, target_id FROM edges
       WHERE source_id IN (SELECT id FROM notes WHERE project_id = ?1)
       AND target_id IS NOT NULL`
    )
    .all(projectId);
  for (const row of existingRows) {
    existingEdges.add(`${row.source_id}:${row.target_id}`);
    existingEdges.add(`${row.target_id}:${row.source_id}`);
  }

  // Strategy 1: Connect notes of the same type that share tags
  const tagMap = new Map<string, string[]>(); // tag -> note ids
  for (const note of allNotes) {
    const tags = JSON.parse(note.tags) as string[];
    for (const tag of tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(note.id);
    }
  }

  const newEdges: { id: string; sourceId: string; targetId: string; type: string; label: string; createdAt: number }[] = [];
  const now = Date.now();
  const addedPairs = new Set<string>();

  // Tag-based connections
  for (const [tag, noteIds] of tagMap) {
    if (noteIds.length < 2 || noteIds.length > 50) continue; // skip too common tags
    for (let i = 0; i < noteIds.length && i < 10; i++) {
      for (let j = i + 1; j < noteIds.length && j < 10; j++) {
        const key = `${noteIds[i]}:${noteIds[j]}`;
        if (existingEdges.has(key) || addedPairs.has(key)) continue;
        addedPairs.add(key);
        addedPairs.add(`${noteIds[j]}:${noteIds[i]}`);
        newEdges.push({
          id: crypto.randomUUID(),
          sourceId: noteIds[i],
          targetId: noteIds[j],
          type: "related",
          label: tag,
          createdAt: now,
        });
      }
    }
  }

  // Strategy 2: FTS5 cross-matching — for each note, find top 2 similar notes by title
  const processed = new Set<string>();
  for (const note of allNotes.slice(0, 200)) { // limit to avoid timeout
    if (processed.has(note.id)) continue;
    processed.add(note.id);

    // Extract meaningful words from title (3+ chars)
    const words = note.title
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 3);

    if (words.length === 0) continue;

    const ftsQuery = words.map((w) => `"${w}"`).join(" OR ");

    try {
      const matches = sqlite
        .query<{ id: string }, [string, string, string]>(
          `SELECT n.id FROM notes_fts f
           JOIN notes n ON n.rowid = f.rowid
           WHERE notes_fts MATCH ?1 AND n.project_id = ?2 AND n.id != ?3
           ORDER BY bm25(notes_fts)
           LIMIT 3`
        )
        .all(ftsQuery, projectId, note.id);

      for (const match of matches) {
        const key = `${note.id}:${match.id}`;
        if (existingEdges.has(key) || addedPairs.has(key)) continue;
        addedPairs.add(key);
        addedPairs.add(`${match.id}:${note.id}`);
        newEdges.push({
          id: crypto.randomUUID(),
          sourceId: note.id,
          targetId: match.id,
          type: "related",
          label: "similar",
          createdAt: now,
        });
      }
    } catch (e) {
      const { logger } = await import("../logger");
      logger.error(e, "FTS auto-link query failed for note");
    }
  }

  // Batch insert
  if (newEdges.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < newEdges.length; i += batchSize) {
      const batch = newEdges.slice(i, i + batchSize);
      await drizzle.insert(edgesTable).values(batch);
    }
  }

  return c.json({ created: newEdges.length, tagBased: tagMap.size, ftsBased: processed.size });
});

export default app;
