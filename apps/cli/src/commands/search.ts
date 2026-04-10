import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

import { BOLD, DIM, RESET } from "../utils/ansi";

function truncate(s: string, len: number): string {
  const clean = s.replace(/\n/g, " ");
  return clean.length > len ? clean.slice(0, len - 1) + "…" : clean;
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

export const searchCommand = new Command("search")
  .description("Search notes")
  .argument("<query>", "Search query")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("--type <type>", "Filter by note type")
  .option("--limit <n>", "Max results", "10")
  .action(async (query: string, opts) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const results = await client.search({
        q: query,
        tags: opts.tags,
        type: opts.type,
        limit: parseInt(opts.limit),
      });

      const notes = Array.isArray(results) ? results : results.results || results.notes || [];

      if (notes.length === 0) {
        console.log(`${DIM}No results found.${RESET}`);
        return;
      }

      // Header
      console.log(
        `${BOLD}${pad("ID", 10)}${pad("Title", 30)}${pad("Type", 12)}${pad("Tags", 20)}Snippet${RESET}`,
      );
      console.log(DIM + "─".repeat(80) + RESET);

      for (const note of notes) {
        const id = note.id.slice(0, 8);
        const title = truncate(note.title, 28);
        const type = note.type;
        const tags = (note.tags || []).join(", ");
        const snippet = truncate(note.content || "", 80);

        console.log(
          `${pad(id, 10)}${pad(title, 30)}${pad(type, 12)}${pad(tags, 20)}${DIM}${snippet}${RESET}`,
        );
      }

      console.log(`\n${DIM}${notes.length} result(s)${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
