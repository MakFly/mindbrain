import { sqlite } from "../db";
import type { NoteType } from "@mindbrain/shared";
import { type RawNoteRow } from "./search";

interface ContextOpts {
  files: string[];
  task: string;
  tags?: string[];
  type?: NoteType;
  limit?: number;
  // Configurable weights
  titleWeight?: number;   // default 3.0
  contentWeight?: number; // default 1.0
  tagsWeight?: number;    // default 2.0
  recencyDecay?: number;  // default 30 (days)
}

interface ScoredNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  score: number;
}

/**
 * Build a phrase-aware FTS5 query for context searches.
 *
 * - Quoted phrases (e.g. "fix login") are kept as exact FTS5 phrases.
 * - Unquoted words are individually quoted and OR-joined.
 */
export function buildContextFtsQuery(raw: string): string {
  const phrases: string[] = [];
  // Extract quoted phrases first
  const withoutPhrases = raw.replace(/"([^"]+)"/g, (_, phrase) => {
    phrases.push(`"${phrase}"`);
    return "";
  });
  // Process remaining words
  const cleaned = withoutPhrases.replace(/[*():^{}~\-+<>]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean).map((w) => `"${w}"`);
  const allTerms = [...phrases, ...words];
  if (allTerms.length === 0) return '""';
  return allTerms.join(" OR ");
}

/**
 * Get contextually relevant notes for a given task and file set.
 *
 * Scoring:
 * 1. FTS5 BM25 rank with field weights (title ×3, content ×1, tags ×2 by default)
 * 2. Graduated file boost based on overlap count and ratio
 * 3. Recency boost: 1 / (1 + daysOld / recencyDecay)
 */
export function getContextualNotes(
  projectId: string,
  opts: ContextOpts
): ScoredNote[] {
  const { files, task, tags, type, limit = 10 } = opts;
  const titleW = opts.titleWeight ?? 3.0;
  const contentW = opts.contentWeight ?? 1.0;
  const tagsW = opts.tagsWeight ?? 2.0;
  const recencyDecay = opts.recencyDecay ?? 30;

  const ftsQuery = buildContextFtsQuery(task);

  // Step 1: FTS5 search with field-weighted bm25 — get 50 candidates
  const candidates = sqlite
    .query<RawNoteRow, [string, string, number, number]>(
      `
      SELECT n.*, bm25(notes_fts, ${titleW}, ${contentW}, ${tagsW}) as rank
      FROM notes_fts f
      JOIN notes n ON n.rowid = f.rowid
      WHERE notes_fts MATCH ?1 AND n.project_id = ?2
      ORDER BY rank
      LIMIT ?3 OFFSET ?4
    `
    )
    .all(ftsQuery, projectId, 50, 0);

  const now = Date.now();
  const fileSet = new Set(files);

  // Step 2: Score each candidate
  let scored: ScoredNote[] = candidates.map((row) => {
    const parsedTags = JSON.parse(row.tags) as string[];
    const parsedMetadata = JSON.parse(row.metadata) as Record<string, unknown>;

    // Negate BM25 rank (FTS5 returns negative values, more negative = better match)
    const bm25Score = -row.rank;

    // Graduated file boost based on overlap count and ratio
    let fileBoost = 1;
    if (fileSet.size > 0 && Array.isArray(parsedMetadata.files)) {
      const noteFiles = parsedMetadata.files as string[];
      const matchCount = noteFiles.filter((f) => fileSet.has(f)).length;
      if (matchCount > 0) {
        const overlapRatio = matchCount / fileSet.size;
        if (overlapRatio > 0.5) {
          fileBoost = 3;
        } else if (matchCount >= 3) {
          fileBoost = 2;
        } else {
          fileBoost = 1.5;
        }
      }
    }

    // Recency boost: 1 / (1 + daysOld / recencyDecay)
    const daysOld = (now - row.updated_at) / (1000 * 60 * 60 * 24);
    const recencyBoost = 1 / (1 + daysOld / recencyDecay);

    const score = bm25Score * fileBoost + recencyBoost;

    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      content: row.content,
      type: row.type as NoteType,
      tags: parsedTags,
      metadata: parsedMetadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      score,
    };
  });

  // Step 3: Post-filter by tags/type
  if (tags && tags.length > 0) {
    scored = scored.filter((note) =>
      tags.some((tag) => note.tags.includes(tag))
    );
  }

  if (type) {
    scored = scored.filter((note) => note.type === type);
  }

  // Step 4: Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Format notes as Markdown for injection into LLM context.
 */
export function formatAsMarkdown(notes: ScoredNote[]): string {
  if (notes.length === 0) return "_No relevant notes found._";

  return notes
    .map((note) => {
      const tagStr =
        note.tags.length > 0 ? `\nTags: ${note.tags.join(", ")}` : "";
      return `## ${note.title}\n_Type: ${note.type} | Score: ${note.score.toFixed(2)}_${tagStr}\n\n${note.content}`;
    })
    .join("\n\n---\n\n");
}
