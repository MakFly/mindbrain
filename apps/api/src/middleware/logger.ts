import { createMiddleware } from "hono/factory";
import { logger } from "../logger";

export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now();
  const { method } = c.req;
  const path = c.req.path;

  await next();

  const status = c.res.status;
  const duration = Date.now() - start;
  const msg = `${method} ${path} ${status} ${duration}ms`;

  if (status >= 500) {
    logger.error({ method, path, status, duration }, msg);
  } else if (status >= 400) {
    logger.warn({ method, path, status, duration }, msg);
  } else {
    logger.info({ method, path, status, duration }, msg);
  }
});
