import { Hono } from "hono";
import { sqlite } from "../db";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET / — list import sources with stats
app.get("/", (c) => {
  const projectId = c.get("projectId");

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
