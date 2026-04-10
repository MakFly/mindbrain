import { join } from "path";
import { readdir, stat } from "fs/promises";
import type { SourceAdapter, SourceEntry } from "./types";
import { parseFrontmatter } from "./utils";

async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function findMdcFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".mdc")) {
        results.push(join(dir, entry.name));
      }
    }
  } catch {
    // Not readable — skip
  }
  return results;
}

async function detect(path: string): Promise<boolean> {
  if (!(await isDir(path))) return false;
  const files = await findMdcFiles(path);
  return files.length > 0;
}

async function scan(path: string): Promise<SourceEntry[]> {
  const files = await findMdcFiles(path);
  const entries: SourceEntry[] = [];

  for (const filePath of files) {
    try {
      const raw = await Bun.file(filePath).text();
      const { frontmatter, body } = parseFrontmatter(raw);

      const description =
        typeof frontmatter.description === "string"
          ? frontmatter.description
          : null;
      const filename = filePath.split("/").pop()?.replace(/\.mdc$/, "") ?? filePath;
      const title = description || filename;

      const globs = Array.isArray(frontmatter.globs)
        ? (frontmatter.globs as string[])
        : typeof frontmatter.globs === "string" && frontmatter.globs
        ? [frontmatter.globs as string]
        : [];

      const tags = ["cursor-rule", ...globs];

      entries.push({
        sourceId: filename,
        title,
        content: body.trim(),
        type: "feedback",
        tags,
        metadata: {
          originalPath: filePath,
          description,
          globs,
          alwaysApply: frontmatter.alwaysApply === true || frontmatter.alwaysApply === "true",
        },
      });
    } catch (err) {
      console.warn(`[cursor-rules] Could not read ${filePath}:`, (err as Error).message);
    }
  }

  return entries;
}

export const cursorRulesAdapter: SourceAdapter = {
  name: "cursor-rules",
  detect,
  scan,
};
