import { createMiddleware } from "hono/factory";
import { logger } from "../logger";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

// Map from API key -> array of request timestamps within the current window
const store = new Map<string, number[]>();

export const rateLimiter = createMiddleware(async (c, next) => {
  // Skip rate limiting for health check
  if (c.req.method === "GET" && c.req.path === "/health") {
    return next();
  }

  const apiKey = c.req.header("X-API-Key") ?? c.req.header("x-api-key") ?? "anonymous";
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get existing timestamps and evict expired ones (sliding window)
  const timestamps = (store.get(apiKey) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  store.set(apiKey, timestamps);

  if (timestamps.length > MAX_REQUESTS) {
    logger.warn({ apiKey: apiKey.slice(0, 8) + "...", count: timestamps.length }, "Rate limit exceeded");
    return c.json({ error: "Too many requests" }, 429);
  }

  return next();
});
