import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";
import { Glob } from "bun";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const TYPE_MAP: Record<string, string> = {
  user: "user",
  feedback: "feedback",
  project: "project",
  reference: "reference",
};

function parseFrontmatter(raw: string): {
  name?: string;
  type?: string;
  description?: string;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { body: raw };

  const frontmatter = match[1];
  const body = match[2];
  const result: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }

  return { name: result.name, type: result.type, description: result.description, body };
}

function extractTags(description?: string): string[] {
  if (!description) return [];
  // Extract meaningful words as tags (skip short words)
  return description
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .map((w) => w.toLowerCase())
    .slice(0, 5);
}

export const importCommand = new Command("import")
  .description("Import memories from external sources or markdown files")
  .argument("[dir]", "Directory to import from (legacy mode)", ".claude/memory/")
  .option("--from <source>", "Import source (claude-mem|mempalace|flat-files|cursor-rules|auto)")
  .option("--dry-run", "Preview what would be imported", false)
  .action(async (dir: string, opts: { from?: string; dryRun?: boolean }) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);

      if (opts.from) {
        // New adapter-based import
        console.log(`${BOLD}Importing from ${opts.from}...${RESET}`);
        if (opts.dryRun) console.log(`${DIM}(dry run)${RESET}`);
        console.log();

        const result = await client.importFrom(opts.from, dir, opts.dryRun || false);

        console.log(`${GREEN}✓${RESET} Imported: ${BOLD}${result.imported}${RESET}`);
        if (result.skipped > 0) console.log(`${DIM}  Skipped: ${result.skipped} (duplicates)${RESET}`);
        if (result.errors > 0) console.log(`${YELLOW}  Errors: ${result.errors}${RESET}`);
        if (result.details && result.details.length > 0) {
          console.log();
          for (const d of result.details) {
            console.log(`  ${DIM}${d}${RESET}`);
          }
        }
        return;
      }

      // Legacy mode: direct .md file import (existing behavior)
      const glob = new Glob("**/*.md");
      let count = 0;

      for await (const path of glob.scan({ cwd: dir, absolute: true })) {
        const content = await Bun.file(path).text();
        const { name, type, description, body } = parseFrontmatter(content);

        const title = name || path.split("/").pop()?.replace(/\.md$/, "") || "Untitled";
        const mappedType = TYPE_MAP[type || ""] || "reference";
        const tags = extractTags(description);

        await client.createNote({
          title,
          content: body,
          type: mappedType,
          tags: tags.length > 0 ? tags : undefined,
        });

        count++;
        console.log(`  ${DIM}+${RESET} ${title} ${DIM}(${mappedType})${RESET}`);
      }

      console.log(`\n${BOLD}Imported ${count} notes from ${dir}${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
