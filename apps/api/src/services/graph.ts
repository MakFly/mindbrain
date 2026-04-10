import { db, sqlite } from "../db";
import { notes, edges } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import type { Note, Edge } from "@mindbrain/shared";
import type { RawNoteRow } from "./search";

interface RawEdgeRow {
  id: string;
  source_id: string;
  target_id: string | null;
  type: string;
  label: string;
  created_at: number;
}

function parseNote(row: RawNoteRow): Note {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    type: row.type as Note["type"],
    tags: JSON.parse(row.tags),
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseEdge(row: RawEdgeRow): Edge {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type as Edge["type"],
    label: row.label,
    createdAt: row.created_at,
  };
}

/**
 * BFS sub-graph traversal from a starting note.
 */
export function getSubGraph(noteId: string, depth: number = 2) {
  const visited = new Set<string>();
  const allEdges: Edge[] = [];
  let frontier = [noteId];

  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const nextFrontier: string[] = [];

    for (const currentId of frontier) {
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Fetch edges in both directions for this node
      const edgeRows = sqlite
        .query<RawEdgeRow, [string]>(
          `SELECT * FROM edges WHERE source_id = ?1 OR target_id = ?1`
        )
        .all(currentId);

      for (const row of edgeRows) {
        const edge = parseEdge(row);
        allEdges.push(edge);

        // Add neighbor to frontier
        const neighborId =
          edge.sourceId === currentId ? edge.targetId : edge.sourceId;
        if (neighborId && !visited.has(neighborId)) {
          nextFrontier.push(neighborId);
        }
      }
    }

    frontier = nextFrontier;
  }

  // Also add remaining frontier nodes as visited (they are leaf nodes)
  for (const id of frontier) visited.add(id);

  // Fetch all visited notes
  if (visited.size === 0) return { nodes: [], edges: [] };

  const placeholders = [...visited].map(() => "?").join(",");
  const noteRows = sqlite
    .query<RawNoteRow, string[]>(
      `SELECT * FROM notes WHERE id IN (${placeholders})`
    )
    .all(...[...visited]);

  // Deduplicate edges by id
  const edgeMap = new Map<string, Edge>();
  for (const e of allEdges) edgeMap.set(e.id, e);

  return {
    nodes: noteRows.map(parseNote),
    edges: [...edgeMap.values()],
  };
}

/**
 * Full project graph: all notes + all edges for a project.
 * @param maxNodes - cap on the number of nodes returned (default 500) to prevent OOM on large projects.
 */
export async function getFullGraph(projectId: string, maxNodes: number = 500) {
  const allNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.projectId, projectId))
    .limit(maxNodes);

  const noteIds = allNotes.map((n) => n.id);
  if (noteIds.length === 0) return { nodes: [], edges: [] };

  // Only fetch edges whose source is among the returned notes
  const placeholders = noteIds.map(() => "?").join(",");
  const allEdges = sqlite
    .query<RawEdgeRow, string[]>(
      `SELECT * FROM edges WHERE source_id IN (${placeholders})`
    )
    .all(...noteIds);

  return {
    nodes: allNotes.map((n) => ({
      ...n,
      tags: JSON.parse(n.tags) as string[],
      metadata: JSON.parse(n.metadata) as Record<string, unknown>,
    })),
    edges: allEdges.map(parseEdge),
  };
}

/**
 * Get all notes that link TO the given note (backlinks).
 */
export function getBacklinks(noteId: string) {
  const rows = sqlite
    .query<RawNoteRow & { edge_id: string; edge_type: string; edge_label: string }, [string]>(
      `
      SELECT n.*, e.id as edge_id, e.type as edge_type, e.label as edge_label
      FROM edges e
      JOIN notes n ON n.id = e.source_id
      WHERE e.target_id = ?1
    `
    )
    .all(noteId);

  return rows.map((row) => ({
    note: parseNote(row),
    edge: {
      id: row.edge_id,
      type: row.edge_type,
      label: row.edge_label,
    },
  }));
}

/**
 * Create a link (edge) between two notes.
 */
export async function createLink(
  sourceId: string,
  targetId: string,
  type: string
) {
  const id = crypto.randomUUID();
  const now = Date.now();

  const [edge] = await db
    .insert(edges)
    .values({
      id,
      sourceId,
      targetId,
      type,
      createdAt: now,
    })
    .returning();

  return edge;
}
