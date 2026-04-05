import { Hono } from "hono";
import { searchQuerySchema, contextRequestSchema } from "@mindbrain/shared";
import { searchNotes } from "../services/search";
import { getContextualNotes, formatAsMarkdown } from "../services/context";

const app = new Hono();

// GET / — FTS5 full-text search
app.get("/", async (c) => {
  const projectId = c.get("projectId") as string;

  const raw = {
    q: c.req.query("q"),
    tags: c.req.query("tags")
      ? c.req.query("tags")!.split(",").filter(Boolean)
      : undefined,
    type: c.req.query("type"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    offset: c.req.query("offset") ? Number(c.req.query("offset")) : undefined,
  };

  // If no query text, fallback to listing by filters (no FTS5)
  if (!raw.q || raw.q.trim() === "") {
    const { listNotes } = await import("../services/notes");
    const limit = raw.limit ?? 20;
    const offset = raw.offset ?? 0;
    const tagsArr = raw.tags as string[] | undefined;
    const type = raw.type as string | undefined;
    const notes = await listNotes(projectId, { type, tags: tagsArr, limit, offset });
    return c.json({ results: notes, count: notes.length });
  }

  const parsed = searchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { q, tags, type, limit, offset } = parsed.data;
  const results = searchNotes(projectId, q, { tags, type, limit, offset });

  return c.json({ results, count: results.length });
});

// POST /context — contextual note retrieval
app.post("/context", async (c) => {
  const projectId = c.get("projectId") as string;
  const body = await c.req.json();

  const parsed = contextRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const notes = getContextualNotes(projectId, parsed.data);
  const markdown = formatAsMarkdown(notes);

  return c.json({ notes, markdown, count: notes.length });
});

export default app;
