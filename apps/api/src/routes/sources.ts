import { Hono } from "hono";
import { sqlite } from "../db";

const app = new Hono();

// GET / — list import sources with stats
app.get("/", (c) => {
  const projectId = c.get("projectId" as never) as string;

  const stats = sqlite
    .query<
      { source: string; count: number; last_import: number },
      [string]
    >(
      `SELECT sm.source, COUNT(*) as count, MAX(sm.imported_at) as last_import
       FROM sources_metadata sm
       JOIN notes n ON n.id = sm.note_id
       WHERE n.project_id = ?1
       GROUP BY sm.source`
    )
    .all(projectId);

  return c.json(stats);
});

export default app;
