import { Database } from "bun:sqlite";
import { join } from "path";
import { readdir, stat } from "fs/promises";
import type { NoteType } from "@mindbrain/shared";
import type { SourceAdapter, SourceEntry } from "./types";

async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function findSqliteFile(path: string): Promise<string | null> {
  // Check for known filenames first
  const candidates = [
    join(path, "chroma.sqlite3"),
    join(path, "mempalace.db"),
    join(path, "data.db"),
  ];
  for (const c of candidates) {
    if (await Bun.file(c).exists()) return c;
  }

  // Scan for any .sqlite3 or .db file
  try {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isFile() &&
        (entry.name.endsWith(".sqlite3") || entry.name.endsWith(".db"))
      ) {
        return join(path, entry.name);
      }
    }
  } catch {
    // pass
  }
  return null;
}

async function detect(path: string): Promise<boolean> {
  if (!(await isDir(path))) return false;
  const sqliteFile = await findSqliteFile(path);
  return sqliteFile !== null;
}

function inferTypeFromHall(hall: string): NoteType {
  switch (hall.toLowerCase()) {
    case "facts":
      return "reference";
    case "events":
      return "project";
    case "discoveries":
      return "codebase";
    case "preferences":
      return "user";
    case "advice":
      return "feedback";
    default:
      return "reference";
  }
}

async function scan(path: string): Promise<SourceEntry[]> {
  const sqliteFile = await findSqliteFile(path);
  if (!sqliteFile) return [];

  const entries: SourceEntry[] = [];
  let db: Database | null = null;

  try {
    db = new Database(sqliteFile, { readonly: true });

    // ChromaDB internal schema exploration — defensive
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )
      .all()
      .map((r) => r.name);

    // Try to read embeddings/documents from ChromaDB schema
    if (tables.includes("embeddings") && tables.includes("collections")) {
      try {
        type EmbeddingRow = {
          id: string | number;
          collection_id: string | number;
          document?: string;
          embedding_id?: string;
        };
        type CollectionRow = {
          id: string | number;
          name?: string;
          dimension?: number;
        };
        type MetadataRow = {
          id: string | number;
          key: string;
          string_value?: string;
        };

        const collections = db
          .query<CollectionRow, []>("SELECT * FROM collections")
          .all();
        const collectionMap = new Map<string | number, string>();
        for (const col of collections) {
          collectionMap.set(col.id, col.name ?? String(col.id));
        }

        const embeddingRows = db
          .query<EmbeddingRow, []>("SELECT * FROM embeddings LIMIT 1000")
          .all();

        // Try to read metadata
        let metaMap = new Map<string | number, Record<string, string>>();
        if (tables.includes("embedding_metadata")) {
          try {
            const metaRows = db
              .query<MetadataRow, []>("SELECT * FROM embedding_metadata")
              .all();
            for (const m of metaRows) {
              if (!metaMap.has(m.id)) metaMap.set(m.id, {});
              metaMap.get(m.id)![m.key] = m.string_value ?? "";
            }
          } catch {
            // ignore
          }
        }

        for (let i = 0; i < embeddingRows.length; i++) {
          const row = embeddingRows[i];
          const meta = metaMap.get(row.id) ?? {};
          const collectionName = collectionMap.get(row.collection_id) ?? "unknown";

          // Parse wing/room/hall from collection name or metadata
          const wing = meta.wing ?? collectionName.split("/")[0] ?? "unknown";
          const room = meta.room ?? collectionName.split("/")[1] ?? "";
          const hall = meta.hall ?? collectionName.split("/")[2] ?? "";

          const content = row.document ?? meta.content ?? meta.text ?? "";
          const snippet = content.slice(0, 80).trimEnd() + (content.length > 80 ? "..." : "");
          const title = meta.title ?? (snippet || `Entry ${row.id}`);

          const tags = ["mempalace", wing];
          if (room) tags.push(room);

          const type = hall ? inferTypeFromHall(hall) : "reference";

          entries.push({
            sourceId: `${row.collection_id}:${i}`,
            title,
            content,
            type,
            tags,
            metadata: {
              source: "mempalace",
              collection: collectionName,
              wing,
              room,
              hall,
              originalMeta: meta,
            },
          });
        }
      } catch (err) {
        console.warn("[mempalace] Could not read ChromaDB embeddings:", (err as Error).message);
      }
    } else {
      // Try generic key-value or note table
      for (const table of tables) {
        if (table.startsWith("sqlite_")) continue;
        try {
          const rows = db
            .query<Record<string, string | number>, []>(`SELECT * FROM "${table}" LIMIT 500`)
            .all();

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const content =
              String(row.content ?? row.text ?? row.body ?? row.note ?? "");
            if (!content) continue;

            const title =
              String(row.title ?? row.name ?? "").trim() ||
              content.slice(0, 80).trimEnd() + (content.length > 80 ? "..." : "");

            entries.push({
              sourceId: `${table}:${i}`,
              title,
              content,
              type: "reference",
              tags: ["mempalace"],
              metadata: { source: "mempalace", table },
            });
          }
        } catch {
          // Table unreadable — skip
        }
      }
    }
  } catch (err) {
    console.warn("[mempalace] Could not open database:", (err as Error).message);
  } finally {
    db?.close();
  }

  return entries;
}

export const mempalaceAdapter: SourceAdapter = {
  name: "mempalace",
  detect,
  scan,
};
