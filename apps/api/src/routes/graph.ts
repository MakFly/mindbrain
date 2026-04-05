import { Hono } from "hono";
import { createLinkSchema } from "@mindbrain/shared";
import {
  getSubGraph,
  getFullGraph,
  getBacklinks,
  createLink,
} from "../services/graph";

const app = new Hono();

// GET / — sub-graph or full project graph
app.get("/", async (c) => {
  const projectId = c.get("projectId") as string;
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

export default app;
