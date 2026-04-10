import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { ensureTables, setupFTS } from "./db";
import { authMiddleware } from "./middleware/auth";
import { requestLogger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rate-limit";
import { logger } from "./logger";
import projectsRoutes from "./routes/projects";
import notesRoutes from "./routes/notes";
import searchRoutes from "./routes/search";
import graphRoutes from "./routes/graph";
import sourcesRoutes from "./routes/sources";
import miningRoutes from "./routes/mining";
import importRoutes from "./routes/import";
import { readFileSync } from "fs";
import { join } from "path";

const app = new Hono();

// Configurable CORS — read allowed origins from CORS_ORIGINS env var (comma-separated)
// Default: http://localhost:5173,http://localhost:3456
// Set CORS_ORIGINS=* to allow all origins
const corsOrigins = process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3456";
const originList = corsOrigins === "*" ? "*" : corsOrigins.split(",").map((o) => o.trim());

app.use(
  "/*",
  cors({
    origin: originList,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

// Request logger — first middleware after CORS
app.use("/*", requestLogger);

// Rate limiter — after logger, before auth
app.use("/*", rateLimiter);

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

// Global error handler
app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

// Serve web frontend static assets in production (SPA with fallback)
if (process.env.NODE_ENV === "production") {
  const webDistPath = join(import.meta.dir, "../../../apps/web/dist");

  // Serve static files
  app.use("/*", serveStatic({ root: webDistPath }));

  // SPA fallback: serve index.html for any non-matched route
  app.get("/*", (c) => {
    const indexHtml = readFileSync(join(webDistPath, "index.html"), "utf-8");
    return c.html(indexHtml);
  });
}

// Initialize DB and start server
ensureTables();
setupFTS();

export default {
  port: 3456,
  fetch: app.fetch,
};
