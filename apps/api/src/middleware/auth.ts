import { createMiddleware } from "hono/factory";
import { getProjectByKeyHash, hashApiKey } from "../services/projects";

export const authMiddleware = createMiddleware(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  const hash = await hashApiKey(apiKey);
  const project = await getProjectByKeyHash(hash);

  if (!project) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  c.set("projectId", project.id);
  await next();
});
