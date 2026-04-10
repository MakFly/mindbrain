import { Hono } from "hono";
import {
  createNoteSchema,
  updateNoteSchema,
} from "@mindbrain/shared";
import type { AppEnv } from "../types";
import { events } from "../services/events";
import {
  createNote,
  getNote,
  updateNote,
  deleteNote,
  listNotes,
  resolveNoteId,
} from "../services/notes";

const app = new Hono<AppEnv>();

// POST / — create note
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const projectId = c.get("projectId");
  const note = await createNote(projectId, parsed.data);
  events.publish("note:created", projectId, note);
  return c.json(note, 201);
});

// GET / — list notes
app.get("/", async (c) => {
  const projectId = c.get("projectId");
  const type = c.req.query("type");
  const tagsParam = c.req.query("tags");
  const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : undefined;
  const limit = Number(c.req.query("limit") || "50");
  const offset = Number(c.req.query("offset") || "0");

  const notes = await listNotes(projectId, { type, tags, limit, offset });
  return c.json(notes);
});

// GET /:id — get note + backlinkCount
app.get("/:id", async (c) => {
  const resolvedId = resolveNoteId(c.req.param("id"));
  if (!resolvedId) return c.json({ error: "Note not found or ambiguous short ID" }, 404);
  const note = await getNote(resolvedId);
  if (!note) return c.json({ error: "Note not found or ambiguous short ID" }, 404);
  return c.json(note);
});

// PUT /:id — update note
app.put("/:id", async (c) => {
  const resolvedId = resolveNoteId(c.req.param("id"));
  if (!resolvedId) return c.json({ error: "Note not found or ambiguous short ID" }, 404);

  const body = await c.req.json();
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const note = await updateNote(resolvedId, parsed.data);
  if (!note) return c.json({ error: "Note not found or ambiguous short ID" }, 404);
  const projectId = c.get("projectId");
  events.publish("note:updated", projectId, note);
  return c.json(note);
});

// DELETE /:id — delete note
app.delete("/:id", async (c) => {
  const resolvedId = resolveNoteId(c.req.param("id"));
  if (!resolvedId) return c.json({ error: "Note not found or ambiguous short ID" }, 404);
  await deleteNote(resolvedId);
  const projectId = c.get("projectId");
  events.publish("note:deleted", projectId, { id: resolvedId });
  return c.body(null, 204);
});

export default app;
