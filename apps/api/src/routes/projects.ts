import { Hono } from "hono";
import type { AppEnv } from "../types";
import { createProjectSchema } from "@mindbrain/shared";
import { createProject, getProjectStats } from "../services/projects";

const app = new Hono<AppEnv>();

// POST / — create project (no auth)
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { name, path } = parsed.data;
  const { project, apiKey } = await createProject(name, path);

  return c.json({ project, apiKey }, 201);
});

// GET /stats — project statistics (uses authenticated project)
app.get("/stats", async (c) => {
  const projectId = c.get("projectId");
  const stats = await getProjectStats(projectId);
  return c.json(stats);
});

export default app;
