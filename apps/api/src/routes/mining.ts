import { Hono } from "hono";
import { mineSchema } from "@mindbrain/shared";
import { mine } from "../services/mining";
import { createNote } from "../services/notes";
import { db, sqlite } from "../db";
import { sourcesMetadata } from "../db/schema";
import { hashContent } from "../utils/hash";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = mineSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const projectId = c.get("projectId");
  const { platform, since, dryRun, llm } = parsed.data;

  const result = await mine({ platform, since, dryRun, llm });

  if (dryRun) {
    return c.json({
      candidates: result.candidates.map((candidate) => ({
        title: candidate.title,
        type: candidate.type,
        confidence: candidate.confidence,
        sourceContext: candidate.sourceContext,
        preview: candidate.content.slice(0, 200),
      })),
      conversationsParsed: result.conversationsParsed,
      platformsScanned: result.platformsScanned,
    });
  }

  // Save candidates as notes
  let saved = 0;
  let skipped = 0;

  for (const candidate of result.candidates) {
    const contentHash = hashContent(candidate.content);

    // Check dedup via content hash
    const existing = sqlite
      .query<{ id: string }, [string]>(
        "SELECT id FROM sources_metadata WHERE content_hash = ?1"
      )
      .get(contentHash);

    if (existing) {
      skipped++;
      continue;
    }

    const note = await createNote(projectId, {
      title: candidate.title,
      content: candidate.content,
      type: candidate.type,
      tags: ["mined", candidate.type],
      metadata: {
        confidence: candidate.confidence,
        sourceContext: candidate.sourceContext,
        minedAt: Date.now(),
      },
    });

    await db.insert(sourcesMetadata).values({
      id: crypto.randomUUID(),
      noteId: note.id,
      source: "mined",
      sourceId: candidate.sourceConversationId,
      importedAt: Date.now(),
      contentHash,
      syncDirection: "import",
    });

    saved++;
  }

  return c.json({
    saved,
    skipped,
    conversationsParsed: result.conversationsParsed,
    platformsScanned: result.platformsScanned,
  });
});

export default app;
