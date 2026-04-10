import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

import { BOLD, DIM, RESET } from "../utils/ansi";

export const rmCommand = new Command("rm")
  .description("Delete a note")
  .argument("<id>", "Note ID")
  .option("--force", "Skip confirmation")
  .action(async (id: string, opts: { force?: boolean }) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    if (!opts.force) {
      process.stdout.write(
        `${BOLD}Delete note ${id.slice(0, 8)}?${RESET} [y/N] `,
      );

      const reader = process.stdin;
      const answer = await new Promise<string>((resolve) => {
        let data = "";
        reader.on("data", (chunk) => {
          data += chunk;
          if (data.includes("\n")) {
            reader.removeAllListeners("data");
            resolve(data.trim().toLowerCase());
          }
        });
        // Handle EOF
        reader.on("end", () => resolve(data.trim().toLowerCase()));
      });

      if (answer !== "y" && answer !== "yes") {
        console.log(`${DIM}Cancelled.${RESET}`);
        return;
      }
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      await client.deleteNote(id);
      console.log(`${BOLD}Deleted${RESET} ${DIM}(${id.slice(0, 8)})${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
