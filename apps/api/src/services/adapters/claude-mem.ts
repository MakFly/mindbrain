import { Database } from "bun:sqlite";
import type { NoteType } from "@mindbrain/shared";
import type { SourceAdapter, SourceEntry } from "./types";

async function detect(path: string): Promise<boolean> {
  if (!(await Bun.file(path).exists())) return false;
  try {
    const db = new Database(path, { readonly: true });
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )
      .all()
      .map((r) => r.name);
    db.close();
    return tables.includes("observations") || tables.includes("summaries");
  } catch {
    return false;
  }
}

function inferObservationType(content: string): NoteType {
  const lower = content.toLowerCase();
  if (
    lower.includes("bug") ||
    lower.includes("error") ||
    lower.includes("debug") ||
    lower.includes("fix")
  ) {
    return "debug";
  }
  return "codebase";
}

async function scan(path: string): Promise<SourceEntry[]> {
  const entries: SourceEntry[] = [];
  let db: Database | null = null;

  try {
    db = new Database(path, { readonly: true });

    // Read observations table
    try {
      const observations = db
        .query<{ id: number | string; content: string; created_at?: number }, []>(
          "SELECT * FROM observations"
        )
        .all();

      for (const row of observations) {
        const content = row.content ?? "";
        const type = inferObservationType(content);
        const title =
          content.length > 80
            ? content.slice(0, 80).trimEnd() + "..."
            : content.trim();

        entries.push({
          sourceId: `observation:${row.id}`,
          title: title || `Observation ${row.id}`,
          content,
          type,
          tags: [],
          metadata: { source: "claude-mem", table: "observations", rowId: row.id },
        });
      }
    } catch (err) {
      console.warn("[claude-mem] Could not read observations table:", (err as Error).message);
    }

    // Read summaries table
    try {
      const summaries = db
        .query<
          { id: number | string; content?: string; summary?: string; title?: string; created_at?: number },
          []
        >("SELECT * FROM summaries")
        .all();

      for (const row of summaries) {
        const content = row.content ?? row.summary ?? "";
        const title = row.title ?? (content.slice(0, 80).trimEnd() + (content.length > 80 ? "..." : ""));

        entries.push({
          sourceId: `summary:${row.id}`,
          title: title || `Summary ${row.id}`,
          content,
          type: "project",
          tags: [],
          metadata: { source: "claude-mem", table: "summaries", rowId: row.id },
        });
      }
    } catch (err) {
      console.warn("[claude-mem] Could not read summaries table:", (err as Error).message);
    }
  } catch (err) {
    console.warn("[claude-mem] Could not open database:", (err as Error).message);
  } finally {
    db?.close();
  }

  return entries;
}

export const claudeMemAdapter: SourceAdapter = {
  name: "claude-mem",
  detect,
  scan,
};
