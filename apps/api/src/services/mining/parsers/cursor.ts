import type { PlatformParser, Conversation } from "../types";
import { stat } from "fs/promises";
import { join } from "path";

const CURSOR_BASE = join(process.env.HOME || "~", ".cursor");

export const cursorParser: PlatformParser = {
  platform: "cursor",

  async detect(): Promise<boolean> {
    try {
      const s = await stat(join(CURSOR_BASE, "logs"));
      return s.isDirectory();
    } catch {
      return false;
    }
  },

  async parse(_opts?: { since?: Date }): Promise<Conversation[]> {
    console.warn("[mining] Cursor parser: format discovery in progress, returning empty");
    // TODO Wave 2: Reverse-engineer Cursor's log format
    return [];
  },
};
