import { Hono } from "hono";
import { cors } from "hono/cors";
import { ensureTables, setupFTS } from "./db";
import { authMiddleware } from "./middleware/auth";
import projectsRoutes from "./routes/projects";
import notesRoutes from "./routes/notes";
import searchRoutes from "./routes/search";
import graphRoutes from "./routes/graph";
import sourcesRoutes from "./routes/sources";
import miningRoutes from "./routes/mining";
import importRoutes from "./routes/import";

const app = new Hono();

// CORS for dashboard
app.use("/*", cors({
  origin: ["http://localhost:5173", "http://localhost:3456"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
}));

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
app.route("/sources", sourcesRoutes);
app.route("/mining", miningRoutes);
app.route("/import", importRoutes);

// Initialize DB and start server
ensureTables();
setupFTS();

export default {
  port: 3456,
  fetch: app.fetch,
};
