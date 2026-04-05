import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const showCommand = new Command("show")
  .description("Show full note details")
  .argument("<id>", "Note ID")
  .action(async (id: string) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const note = await client.getNote(id);

      console.log(`${BOLD}${note.title}${RESET} ${DIM}(${note.id.slice(0, 8)})${RESET}`);
      console.log(`${DIM}Type:${RESET}    ${note.type}`);
      console.log(`${DIM}Tags:${RESET}    ${(note.tags || []).join(", ") || "—"}`);
      console.log(`${DIM}Created:${RESET} ${new Date(note.createdAt).toLocaleString()}`);
      console.log(`${DIM}Updated:${RESET} ${new Date(note.updatedAt).toLocaleString()}`);

      if (note.metadata && Object.keys(note.metadata).length > 0) {
        console.log(`${DIM}Meta:${RESET}    ${JSON.stringify(note.metadata)}`);
      }

      console.log();
      console.log(note.content);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
