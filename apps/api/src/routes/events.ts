import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { events, type EventPayload } from "../services/events";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/", (c) => {
  const projectId = c.get("projectId");

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ projectId }),
    });

    const listener = (payload: EventPayload) => {
      if (payload.projectId !== projectId) return;
      stream.writeSSE({
        event: payload.type,
        data: JSON.stringify(payload.data),
      });
    };

    events.on("app:event", listener);

    stream.onAbort(() => {
      events.off("app:event", listener);
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(resolve);
    });
  });
});

export default app;
