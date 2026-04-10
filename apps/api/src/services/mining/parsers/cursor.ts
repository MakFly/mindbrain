import type { PlatformParser, Conversation, Message } from "../types";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const HOME = process.env.HOME || "~";

// Cursor stores workspace-scoped data in VSCode-style workspaceStorage SQLite files.
// Each workspace has a state.vscdb (SQLite) with an ItemTable that holds:
//   - "aiService.generations": array of user prompts (with timestamps and UUIDs)
//   - "composer.composerData": metadata about Composer sessions (no message text)
// Assistant responses are NOT persisted to disk — only user prompts are recoverable.
// We reconstruct one Conversation per workspace from the "aiService.generations" array.

const CURSOR_WORKSPACE_STORAGE = join(
  HOME,
  "Library",
  "Application Support",
  "Cursor",
  "User",
  "workspaceStorage"
);

// Fallback location for Linux
const CURSOR_WORKSPACE_STORAGE_LINUX = join(HOME, ".config", "Cursor", "User", "workspaceStorage");

export const cursorParser: PlatformParser = {
  platform: "cursor",

  async detect(): Promise<boolean> {
    for (const base of [CURSOR_WORKSPACE_STORAGE, CURSOR_WORKSPACE_STORAGE_LINUX]) {
      try {
        const s = await stat(base);
        if (s.isDirectory()) return true;
      } catch {
        // not found, try next
      }
    }
    return false;
  },

  async parse(opts?: { since?: Date }): Promise<Conversation[]> {
    const sinceTs = opts?.since?.getTime() ?? 0;
    const conversations: Conversation[] = [];

    let storageBase: string | null = null;
    for (const base of [CURSOR_WORKSPACE_STORAGE, CURSOR_WORKSPACE_STORAGE_LINUX]) {
      try {
        const s = await stat(base);
        if (s.isDirectory()) {
          storageBase = base;
          break;
        }
      } catch {
        // continue
      }
    }

    if (!storageBase) {
      console.warn("[mining] Cursor workspaceStorage not found");
      return [];
    }

    let workspaceDirs: string[] = [];
    try {
      const entries = await readdir(storageBase, { withFileTypes: true });
      workspaceDirs = entries.filter((e) => e.isDirectory()).map((e) => join(storageBase!, e.name));
    } catch {
      console.warn("[mining] Cannot read Cursor workspaceStorage directory");
      return [];
    }

    for (const wsDir of workspaceDirs) {
      const dbPath = join(wsDir, "state.vscdb");
      try {
        await stat(dbPath);
      } catch {
        continue; // no state.vscdb in this workspace
      }

      try {
        const conv = await parseWorkspaceDb(dbPath, sinceTs);
        if (conv) conversations.push(conv);
      } catch {
        // Skip unreadable or incompatible DB files
      }
    }

    return conversations;
  },
};

async function parseWorkspaceDb(dbPath: string, sinceTs: number): Promise<Conversation | null> {
  // Use Bun's sqlite module to read the workspace DB
  const { Database } = await import("bun:sqlite");
  const db = new Database(dbPath, { readonly: true });

  try {
    // Query user prompts from aiService.generations
    const row = db.query("SELECT value FROM ItemTable WHERE key = 'aiService.generations'").get() as
      | { value: string }
      | undefined;

    if (!row?.value) return null;

    const generations = JSON.parse(row.value);
    if (!Array.isArray(generations) || generations.length === 0) return null;

    // Filter by since timestamp
    const filtered = generations.filter((g: any) => typeof g.unixMs === "number" && g.unixMs >= sinceTs);
    if (filtered.length === 0) return null;

    // Build messages from user prompts only (assistant responses are not stored on disk)
    const messages: Message[] = filtered
      .filter((g: any) => g.textDescription && typeof g.textDescription === "string")
      .map((g: any): Message => ({
        role: "user",
        content: g.textDescription.trim(),
        timestamp: g.unixMs,
      }));

    if (messages.length === 0) return null;

    const earliest = filtered.reduce(
      (min: number, g: any) => Math.min(min, g.unixMs ?? Infinity),
      Infinity
    );

    return {
      id: `cursor:${dbPath}`,
      messages,
      platform: "cursor",
      startedAt: earliest === Infinity ? Date.now() : earliest,
      path: dbPath,
    };
  } finally {
    db.close();
  }
}
