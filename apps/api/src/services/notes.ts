import { db, sqlite } from "../db";
import { notes, edges } from "../db/schema";
import { eq, and, isNull, sql, desc, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Short ID prefix lookup
// ---------------------------------------------------------------------------

export function resolveNoteId(idOrPrefix: string): string | null {
  // Full UUID — return as-is
  if (idOrPrefix.length === 36) return idOrPrefix;

  const rows = sqlite
    .query<{ id: string }, [string]>("SELECT id FROM notes WHERE id LIKE ?1")
    .all(`${idOrPrefix}%`);

  if (rows.length === 1) return rows[0].id;
  return null;
}

// ---------------------------------------------------------------------------
// Wikilink parser
// ---------------------------------------------------------------------------

export function parseWikilinks(content: string): string[] {
  const matches: string[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Wikilink sync
// ---------------------------------------------------------------------------

export async function syncWikilinks(
  noteId: string,
  projectId: string,
  content: string
) {
  // Delete all old wikilink edges for this note
  await db
    .delete(edges)
    .where(and(eq(edges.sourceId, noteId), eq(edges.type, "wikilink")));

  const titles = parseWikilinks(content);
  if (titles.length === 0) return;

  // Find matching notes by title + projectId (excluding self)
  const existingNotes = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(eq(notes.projectId, projectId));

  const titleToId = new Map<string, string>();
  for (const n of existingNotes) {
    titleToId.set(n.title, n.id);
  }

  const now = Date.now();
  const edgeRows = titles.map((title) => {
    const targetId = titleToId.get(title) ?? null;
    return {
      id: crypto.randomUUID(),
      sourceId: noteId,
      targetId,
      type: "wikilink" as const,
      label: title,
      createdAt: now,
    };
  });

  if (edgeRows.length > 0) {
    await db.insert(edges).values(edgeRows);
  }
}

// ---------------------------------------------------------------------------
// Resolve dangling links when a new note is created
// ---------------------------------------------------------------------------

export async function resolveDanglingLinks(
  projectId: string,
  title: string,
  noteId: string
) {
  // Find edges with null targetId AND label = title where the source note
  // belongs to the same project
  await db
    .update(edges)
    .set({ targetId: noteId })
    .where(
      and(
        isNull(edges.targetId),
        eq(edges.label, title),
        eq(edges.type, "wikilink"),
        sql`${edges.sourceId} IN (SELECT id FROM notes WHERE project_id = ${projectId})`
      )
    );
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createNote(
  projectId: string,
  data: {
    title: string;
    content: string;
    type: string;
    tags: string[];
    metadata: Record<string, unknown>;
  }
) {
  const id = crypto.randomUUID();
  const now = Date.now();

  const row = {
    id,
    projectId,
    title: data.title,
    content: data.content,
    type: data.type,
    tags: JSON.stringify(data.tags),
    metadata: JSON.stringify(data.metadata),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(notes).values(row);
  await syncWikilinks(id, projectId, data.content);
  await resolveDanglingLinks(projectId, data.title, id);

  return { ...row, tags: data.tags, metadata: data.metadata };
}

export async function getNote(id: string) {
  const [note] = await db.select().from(notes).where(eq(notes.id, id));
  if (!note) return null;

  const [backlinks] = await db
    .select({ value: count() })
    .from(edges)
    .where(and(eq(edges.targetId, id), eq(edges.type, "wikilink")));

  return {
    ...note,
    tags: JSON.parse(note.tags),
    metadata: JSON.parse(note.metadata),
    backlinkCount: backlinks?.value ?? 0,
  };
}

export async function updateNote(
  id: string,
  data: {
    title?: string;
    content?: string;
    type?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }
) {
  const [existing] = await db.select().from(notes).where(eq(notes.id, id));
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) updates.content = data.content;
  if (data.type !== undefined) updates.type = data.type;
  if (data.tags !== undefined) updates.tags = JSON.stringify(data.tags);
  if (data.metadata !== undefined)
    updates.metadata = JSON.stringify(data.metadata);

  await db.update(notes).set(updates).where(eq(notes.id, id));

  if (data.content !== undefined) {
    await syncWikilinks(id, existing.projectId, data.content);
  }

  const [updated] = await db.select().from(notes).where(eq(notes.id, id));
  return {
    ...updated,
    tags: JSON.parse(updated.tags),
    metadata: JSON.parse(updated.metadata),
  };
}

export async function deleteNote(id: string) {
  await db.delete(notes).where(eq(notes.id, id));
}

export async function listNotes(
  projectId: string,
  opts: {
    type?: string;
    tags?: string[];
    limit: number;
    offset: number;
  }
) {
  const conditions = [eq(notes.projectId, projectId)];

  if (opts.type) {
    conditions.push(eq(notes.type, opts.type));
  }

  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      conditions.push(sql`${notes.tags} LIKE ${"%" + tag + "%"}`);
    }
  }

  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.updatedAt))
    .limit(opts.limit)
    .offset(opts.offset);

  return rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags),
    metadata: JSON.parse(row.metadata),
  }));
}
