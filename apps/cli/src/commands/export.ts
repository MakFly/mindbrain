import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";
import { mkdir } from "fs/promises";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toFrontmatter(note: { title: string; type: string; tags?: string[] }): string {
  const lines = ["---", `name: ${note.title}`, `type: ${note.type}`];
  if (note.tags && note.tags.length > 0) {
    lines.push(`tags: ${note.tags.join(", ")}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export const exportCommand = new Command("export")
  .description("Export all notes as markdown files")
  .argument("[dir]", "Output directory", "./mindbrain-export/")
  .action(async (dir: string) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const result = await client.listAllNotes(1000);
      const notes = result.notes || result || [];

      await mkdir(dir, { recursive: true });

      let count = 0;
      const usedSlugs = new Set<string>();

      for (const note of notes) {
        let filename = slug(note.title) || `note-${note.id.slice(0, 8)}`;

        // Deduplicate filenames
        if (usedSlugs.has(filename)) {
          filename = `${filename}-${note.id.slice(0, 8)}`;
        }
        usedSlugs.add(filename);

        const frontmatter = toFrontmatter(note);
        const content = `${frontmatter}\n${note.content}`;
        const filePath = `${dir}/${filename}.md`;

        await Bun.write(filePath, content);
        count++;
        console.log(`  ${DIM}>${RESET} ${filePath}`);
      }

      console.log(`\n${BOLD}Exported ${count} notes to ${dir}${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
