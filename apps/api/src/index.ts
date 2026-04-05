import { Hono } from "hono";
import { ensureTables, setupFTS } from "./db";
import { authMiddleware } from "./middleware/auth";
import projectsRoutes from "./routes/projects";
import notesRoutes from "./routes/notes";
import searchRoutes from "./routes/search";
import graphRoutes from "./routes/graph";

const app = new Hono();

// Health check — no auth
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth middleware on all routes EXCEPT POST /projects and GET /health
app.use("/*", async (c, next) => {
  // Skip auth for POST /projects (project creation is public)
  if (c.req.method === "POST" && c.req.path === "/projects") {
    return next();
  }
  return authMiddleware(c, next);
});

// Mount routes
app.route("/projects", projectsRoutes);
app.route("/notes", notesRoutes);
app.route("/search", searchRoutes);
app.route("/graph", graphRoutes);

// Initialize DB and start server
ensureTables();
setupFTS();

export default {
  port: 3456,
  fetch: app.fetch,
};
