import type { PlatformParser, Conversation } from "../types";
import { stat } from "fs/promises";
import { join } from "path";

const CODEX_BASE = join(process.env.HOME || "~", ".codex");

export const codexParser: PlatformParser = {
  platform: "codex",

  async detect(): Promise<boolean> {
    try {
      const s = await stat(join(CODEX_BASE, "sessions"));
      return s.isDirectory();
    } catch {
      return false;
    }
  },

  async parse(_opts?: { since?: Date }): Promise<Conversation[]> {
    console.warn("[mining] Codex parser: format discovery in progress, returning empty");
    // TODO Wave 2: Reverse-engineer Codex's session format
    return [];
  },
};
