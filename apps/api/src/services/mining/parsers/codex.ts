import type { PlatformParser, Conversation, Message } from "../types";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const HOME = process.env.HOME || "~";
const CODEX_BASE = join(HOME, ".codex");
const CODEX_SESSIONS_BASE = join(CODEX_BASE, "sessions");

// OpenAI Codex CLI persists full conversation history as JSONL files under:
//   ~/.codex/sessions/YYYY/MM/DD/rollout-<ISO>-<uuid>.jsonl
//
// Each line is a JSON object with a "type" field:
//   - "session_meta": session metadata (id, cwd, timestamp, model, etc.)
//   - "response_item": a conversation item with role (user | assistant | developer | tool)
//   - "event_msg": streaming events (model output, tool calls) — not parsed here
//   - "turn_context": per-turn metadata
//
// For response_item entries:
//   - user role:      payload.content is an array of {type: "input_text", text: string}
//   - assistant role: payload.content is an array of {type: "output_text", text: string}
//   - developer role: system/instructions — skipped

export const codexParser: PlatformParser = {
  platform: "codex",

  async detect(): Promise<boolean> {
    try {
      const s = await stat(CODEX_SESSIONS_BASE);
      return s.isDirectory();
    } catch {
      return false;
    }
  },

  async parse(opts?: { since?: Date }): Promise<Conversation[]> {
    const sinceTs = opts?.since?.getTime() ?? 0;
    const conversations: Conversation[] = [];

    try {
      await stat(CODEX_SESSIONS_BASE);
    } catch {
      console.warn("[mining] Codex sessions directory not found at ~/.codex/sessions/");
      return [];
    }

    // Recursively collect all .jsonl files (structure: sessions/YYYY/MM/DD/*.jsonl)
    const jsonlFiles = await collectJsonlFiles(CODEX_SESSIONS_BASE, sinceTs);

    for (const filePath of jsonlFiles) {
      try {
        const conv = await parseSessionFile(filePath);
        if (conv && conv.messages.length > 0) {
          conversations.push(conv);
        }
      } catch {
        // Skip unreadable or malformed session files
      }
    }

    return conversations;
  },
};

async function collectJsonlFiles(dir: string, sinceTs: number): Promise<string[]> {
  const results: string[] = [];

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJsonlFiles(fullPath, sinceTs);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      try {
        const s = await stat(fullPath);
        if (s.mtimeMs >= sinceTs) {
          results.push(fullPath);
        }
      } catch {
        // Skip stat errors
      }
    }
  }

  return results;
}

async function parseSessionFile(filePath: string): Promise<Conversation | null> {
  const raw = await Bun.file(filePath).text();
  const lines = raw.trim().split("\n").filter(Boolean);

  let sessionId: string | null = null;
  let sessionTimestamp: number | null = null;
  const messages: Message[] = [];

  for (const line of lines) {
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const entryTs = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;

    if (entry.type === "session_meta") {
      const payload = entry.payload;
      if (payload?.id) sessionId = payload.id;
      if (payload?.timestamp) {
        sessionTimestamp = new Date(payload.timestamp).getTime();
      }
      continue;
    }

    if (entry.type === "response_item") {
      const payload = entry.payload;
      if (!payload || typeof payload !== "object") continue;

      const role: string = payload.role || payload.type || "";

      // Skip developer (system instructions) and tool results
      if (role === "developer" || role === "tool") continue;

      const normalizedRole = normalizeRole(role);
      const content = extractContent(payload);

      if (content) {
        messages.push({
          role: normalizedRole,
          content,
          timestamp: entryTs,
        });
      }
    }
  }

  if (messages.length === 0) return null;

  // Derive conversation ID from filename if session_meta was missing
  const derivedId = sessionId || filePath;
  const startedAt =
    sessionTimestamp ??
    messages.find((m) => m.timestamp)?.timestamp ??
    Date.now();

  return {
    id: derivedId,
    messages,
    platform: "codex",
    startedAt,
    path: filePath,
  };
}

function normalizeRole(role: string): Message["role"] {
  const r = role.toLowerCase();
  if (r === "user" || r === "human") return "user";
  if (r === "assistant" || r === "ai" || r === "model") return "assistant";
  if (r === "system") return "system";
  if (r === "tool" || r === "function") return "tool";
  return "user";
}

function extractContent(payload: any): string {
  const content = payload.content;

  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (typeof block === "string") {
        parts.push(block);
      } else if (typeof block === "object" && block !== null) {
        // input_text (user), output_text (assistant)
        if (typeof block.text === "string") parts.push(block.text);
        // text field used in some variants
        if (typeof block.content === "string") parts.push(block.content);
      }
    }
    return parts.join("\n").trim();
  }

  return "";
}
