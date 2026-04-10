import type { PlatformParser, Conversation, Message } from "../types";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const CLAUDE_BASE = join(process.env.HOME || "~", ".claude", "projects");

export const claudeCodeParser: PlatformParser = {
  platform: "claude-code",

  async detect(): Promise<boolean> {
    try {
      const s = await stat(CLAUDE_BASE);
      return s.isDirectory();
    } catch {
      return false;
    }
  },

  async parse(opts?: { since?: Date }): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const sinceTs = opts?.since?.getTime() ?? 0;

    try {
      // List project directories
      const projects = await readdir(CLAUDE_BASE, { withFileTypes: true });

      for (const project of projects) {
        if (!project.isDirectory()) continue;

        const projectPath = join(CLAUDE_BASE, project.name);

        // Try multiple possible locations for conversation data
        for (const subdir of ["conversations", "sessions", ""]) {
          const searchPath = subdir ? join(projectPath, subdir) : projectPath;

          try {
            const files = await readdir(searchPath, { withFileTypes: true });

            for (const file of files) {
              if (!file.name.endsWith(".json") && !file.name.endsWith(".jsonl")) continue;

              const filePath = join(searchPath, file.name);

              try {
                const fileStat = await stat(filePath);
                if (fileStat.mtimeMs < sinceTs) continue;

                const raw = await Bun.file(filePath).text();
                const parsed = tryParseConversation(raw, filePath, fileStat.mtimeMs);
                if (parsed && parsed.messages.length > 0) {
                  conversations.push(parsed);
                }
              } catch {
                // Skip unreadable files
              }
            }
          } catch {
            // Directory doesn't exist, continue
          }
        }
      }
    } catch {
      console.warn("[mining] Claude Code projects directory not accessible");
    }

    return conversations;
  },
};

function tryParseConversation(raw: string, filePath: string, mtimeMs: number): Conversation | null {
  try {
    // Try as a single JSON object
    const data = JSON.parse(raw);

    // Handle array of messages format
    if (Array.isArray(data)) {
      const messages = data
        .filter((m: any) => m.content || m.text || m.message)
        .map((m: any): Message => ({
          role: normalizeRole(m.role || m.type || "unknown"),
          content: extractContent(m),
          timestamp: m.timestamp || m.created_at || m.ts,
        }));

      return {
        id: filePath,
        messages,
        platform: "claude-code",
        startedAt: mtimeMs,
        path: filePath,
      };
    }

    // Handle object with messages array
    if (data.messages && Array.isArray(data.messages)) {
      const messages = data.messages
        .filter((m: any) => m.content || m.text)
        .map((m: any): Message => ({
          role: normalizeRole(m.role || "unknown"),
          content: extractContent(m),
          timestamp: m.timestamp || m.created_at,
        }));

      return {
        id: data.id || filePath,
        messages,
        platform: "claude-code",
        startedAt: data.created_at || data.timestamp || mtimeMs,
        path: filePath,
      };
    }

    return null;
  } catch {
    // Try JSONL format
    try {
      const lines = raw.trim().split("\n").filter(Boolean);
      const messages: Message[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.content || entry.text || entry.message) {
            messages.push({
              role: normalizeRole(entry.role || entry.type || "unknown"),
              content: extractContent(entry),
              timestamp: entry.timestamp || entry.ts,
            });
          }
        } catch {
          // Skip unparseable lines
        }
      }

      if (messages.length > 0) {
        return {
          id: filePath,
          messages,
          platform: "claude-code",
          startedAt: mtimeMs,
          path: filePath,
        };
      }
    } catch {
      // Not JSONL either
    }
    return null;
  }
}

function normalizeRole(role: string): Message["role"] {
  const r = role.toLowerCase();
  if (r === "human" || r === "user") return "user";
  if (r === "assistant" || r === "ai" || r === "claude") return "assistant";
  if (r === "system") return "system";
  if (r === "tool" || r === "tool_result") return "tool";
  return "user";
}

function extractContent(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (typeof msg.text === "string") return msg.text;
  if (typeof msg.message === "string") return msg.message;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((block: any) => block.type === "text" || typeof block === "string")
      .map((block: any) => (typeof block === "string" ? block : block.text || ""))
      .join("\n");
  }
  return JSON.stringify(msg.content || "");
}
