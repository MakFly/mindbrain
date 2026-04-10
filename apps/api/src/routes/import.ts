import { Hono } from "hono";
import { importSchema } from "@mindbrain/shared";
import { getAdapter, detectAll } from "../services/adapters";
import { createNote } from "../services/notes";
import { db, sqlite } from "../db";
import { sourcesMetadata } from "../db/schema";
import { hashContent } from "../utils/hash";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const projectId = c.get("projectId");
  const { source, path, dryRun } = parsed.data;

  const adapter = getAdapter(source);

  const isAvailable = await adapter.detect(path);
  if (!isAvailable) {
    return c.json({ error: `Source not found at path: ${path}` }, 404);
  }

  const entries = await adapter.scan(path);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const details: string[] = [];

  for (const entry of entries) {
    try {
      const contentHash = hashContent(entry.content);

      // Check if already imported via content hash
      const existing = sqlite
        .query<{ id: string }, [string]>(
          "SELECT id FROM sources_metadata WHERE content_hash = ?1"
        )
        .get(contentHash);

      if (existing) {
        skipped++;
        continue;
      }

      if (dryRun) {
        imported++;
        details.push(`[DRY RUN] Would import: ${entry.title} (${entry.type})`);
        continue;
      }

      // Create the note
      const note = await createNote(projectId, {
        title: entry.title,
        content: entry.content,
        type: entry.type,
        tags: entry.tags,
        metadata: entry.metadata,
      });

      // Track source metadata
      await db.insert(sourcesMetadata).values({
        id: crypto.randomUUID(),
        noteId: note.id,
        source,
        sourceId: entry.sourceId,
        importedAt: Date.now(),
        contentHash,
        syncDirection: "import",
      });

      imported++;
    } catch (err) {
      errors++;
      details.push(
        `Error importing "${entry.title}": ${(err as Error).message}`
      );
    }
  }

  return c.json({ imported, skipped, errors, details });
});

export default app;
