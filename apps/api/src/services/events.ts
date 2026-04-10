import { EventEmitter } from "events";

export type EventType =
  | "note:created"
  | "note:updated"
  | "note:deleted"
  | "edge:created"
  | "import:completed"
  | "mining:completed";

export interface EventPayload {
  type: EventType;
  projectId: string;
  data: unknown;
}

class AppEventEmitter extends EventEmitter {
  emit(event: "app:event", payload: EventPayload): boolean {
    return super.emit(event, payload);
  }

  on(event: "app:event", listener: (payload: EventPayload) => void): this {
    return super.on(event, listener);
  }

  off(event: "app:event", listener: (payload: EventPayload) => void): this {
    return super.off(event, listener);
  }

  publish(type: EventType, projectId: string, data: unknown): void {
    this.emit("app:event", { type, projectId, data });
  }
}

export const events = new AppEventEmitter();
