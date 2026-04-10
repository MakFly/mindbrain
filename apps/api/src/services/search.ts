import { sqlite } from "../db";
import type { NoteType } from "@mindbrain/shared";

interface SearchOpts {
  tags?: string[];
  type?: NoteType;
  limit?: number;
  offset?: number;
}

export interface RawNoteRow {
  id: string;
  project_id: string;
  title: string;
  content: string;
  type: string;
  tags: string;
  metadata: string;
  created_at: number;
  updated_at: number;
  rank: number;
}

/**
 * Sanitize a user query for FTS5: escape special operators and wrap words in quotes.
 */
function sanitizeFtsQuery(raw: string): string {
  // Remove FTS5 operators and special chars, then wrap each word in quotes
  const cleaned = raw.replace(/[*"():^{}~\-+<>]/g, " ").trim();
  if (!cleaned) return '""';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word}"`)
    .join(" OR ");
}

function parseNoteRow(row: RawNoteRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    type: row.type as NoteType,
    tags: JSON.parse(row.tags) as string[],
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rank: row.rank,
  };
}

export function searchNotes(
  projectId: string,
  q: string,
  opts: SearchOpts = {}
) {
  const { limit = 20, offset = 0, tags, type } = opts;
  const sanitizedQuery = sanitizeFtsQuery(q);

  const rows = sqlite
    .query<RawNoteRow, [string, string, number, number]>(
      `
      SELECT n.*, bm25(notes_fts) as rank
      FROM notes_fts f
      JOIN notes n ON n.rowid = f.rowid
      WHERE notes_fts MATCH ?1 AND n.project_id = ?2
      ORDER BY rank
      LIMIT ?3 OFFSET ?4
    `
    )
    .all(sanitizedQuery, projectId, limit, offset);

  let results = rows.map(parseNoteRow);

  // Post-filter by tags if provided
  if (tags && tags.length > 0) {
    results = results.filter((note) =>
      tags.some((tag) => note.tags.includes(tag))
    );
  }

  // Post-filter by type if provided
  if (type) {
    results = results.filter((note) => note.type === type);
  }

  return results;
}

export { sanitizeFtsQuery, parseNoteRow, type RawNoteRow };
