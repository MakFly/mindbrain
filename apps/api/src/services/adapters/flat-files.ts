import { join } from "path";
import { readdir, stat } from "fs/promises";
import type { NoteType } from "@mindbrain/shared";
import type { SourceAdapter, SourceEntry } from "./types";

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter: Record<string, unknown> = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    // Simple YAML array: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      frontmatter[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return { frontmatter, body: match[2] };
}

function inferType(filePath: string, fm: Record<string, unknown>): NoteType {
  if (fm.type && typeof fm.type === "string") {
    const valid = ["user", "feedback", "project", "reference", "codebase", "debug"];
    if (valid.includes(fm.type)) return fm.type as NoteType;
  }
  if (filePath.includes("/rules/")) return "feedback";
  if (filePath.includes("/memory/")) return "reference";
  return "codebase";
}

function extractTitle(
  fm: Record<string, unknown>,
  body: string,
  filePath: string
): string {
  if (fm.name && typeof fm.name === "string") return fm.name;
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  return filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
}

async function globMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await globMdFiles(full);
        results.push(...sub);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(full);
      }
    }
  } catch {
    // Directory doesn't exist or not readable — skip
  }
  return results;
}

async function pathExists(p: string): Promise<boolean> {
  return Bun.file(p).exists();
}

async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function detect(path: string): Promise<boolean> {
  if (!(await isDir(path))) return false;
  const checks = [
    Bun.file(join(path, "CLAUDE.md")).exists(),
    Bun.file(join(path, "MEMORY.md")).exists(),
    isDir(join(path, "rules")),
  ];
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

async function scan(path: string): Promise<SourceEntry[]> {
  const dirs = [path, join(path, "rules"), join(path, "memory")];
  const allFiles: string[] = [];
  for (const d of dirs) {
    const files = await globMdFiles(d);
    allFiles.push(...files);
  }

  // Deduplicate by absolute path
  const unique = [...new Set(allFiles)];

  const entries: SourceEntry[] = [];
  for (const filePath of unique) {
    try {
      const raw = await Bun.file(filePath).text();
      const { frontmatter, body } = parseFrontmatter(raw);
      const type = inferType(filePath, frontmatter);
      const title = extractTitle(frontmatter, body, filePath);
      const tags = Array.isArray(frontmatter.tags)
        ? (frontmatter.tags as string[])
        : [];

      // sourceId = relative path from base
      const sourceId = filePath.startsWith(path)
        ? filePath.slice(path.length).replace(/^\//, "")
        : filePath;

      entries.push({
        sourceId,
        title,
        content: body.trim(),
        type,
        tags,
        metadata: {
          originalPath: filePath,
          frontmatter,
        },
      });
    } catch (err) {
      console.warn(`[flat-files] Could not read ${filePath}:`, (err as Error).message);
    }
  }
  return entries;
}

export const flatFilesAdapter: SourceAdapter = {
  name: "flat-files",
  detect,
  scan,
};
