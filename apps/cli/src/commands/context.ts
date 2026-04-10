import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

import { BOLD, DIM, RESET } from "../utils/ansi";

export const contextCommand = new Command("context")
  .description("Get relevant context for a task")
  .requiredOption("-t, --task <task>", "Task description")
  .option("-f, --files <paths...>", "Relevant file paths")
  .option("--limit <n>", "Max notes", "5")
  .action(async (opts) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const result = await client.context({
        files: opts.files || [],
        task: opts.task,
        limit: parseInt(opts.limit),
      });

      const notes = Array.isArray(result) ? result : result.notes || [];

      if (notes.length === 0) {
        console.log(`${DIM}No relevant context found.${RESET}`);
        return;
      }

      for (const note of notes) {
        console.log(`## ${note.title} ${DIM}(${note.id.slice(0, 8)})${RESET}`);
        console.log(`${DIM}Type: ${note.type} | Tags: ${(note.tags || []).join(", ")}${RESET}`);
        console.log();
        console.log(note.content);
        console.log();
        console.log("---");
        console.log();
      }
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
