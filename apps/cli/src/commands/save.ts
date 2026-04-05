import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const saveCommand = new Command("save")
  .description("Save a note to Mindbrain")
  .argument("<title>", "Note title")
  .requiredOption("-t, --type <type>", "Note type (user|feedback|project|reference|codebase|debug)")
  .option("--tags <tags>", "Comma-separated tags")
  .option("-f, --file <path>", "Read content from file")
  .option("-m, --meta <json>", "Metadata as JSON string")
  .action(async (title: string, opts) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    let content: string;

    if (opts.file) {
      const file = Bun.file(opts.file);
      if (!(await file.exists())) {
        process.stderr.write(`Error: File not found: ${opts.file}\n`);
        process.exit(1);
      }
      content = await file.text();
    } else if (!process.stdin.isTTY) {
      // Piped stdin
      content = await new Response(process.stdin as unknown as ReadableStream).text();
    } else {
      process.stderr.write("Error: Provide content via --file or stdin pipe.\n");
      process.exit(1);
    }

    const tags = opts.tags ? opts.tags.split(",").map((t: string) => t.trim()) : [];
    let metadata: Record<string, unknown> = {};
    if (opts.meta) {
      try {
        metadata = JSON.parse(opts.meta);
      } catch {
        process.stderr.write("Error: Invalid JSON for --meta.\n");
        process.exit(1);
      }
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const note = await client.createNote({
        title,
        content,
        type: opts.type,
        tags,
        metadata,
      });

      console.log(
        `${BOLD}Saved:${RESET} ${note.title} ${DIM}(${note.id.slice(0, 8)})${RESET}`,
      );
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
