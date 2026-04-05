import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";
import { unlinkSync } from "fs";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const editCommand = new Command("edit")
  .description("Edit a note in $EDITOR")
  .argument("<id>", "Note ID (or short prefix)")
  .action(async (id: string) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const note = await client.getNote(id);

      const tmpPath = `/tmp/mb-edit-${note.id.slice(0, 8)}.md`;
      await Bun.write(tmpPath, note.content);

      const editor = process.env.EDITOR || "vim";
      const proc = Bun.spawn([editor, tmpPath], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;

      const updated = await Bun.file(tmpPath).text();
      await client.updateNote(note.id, { content: updated });

      try {
        unlinkSync(tmpPath);
      } catch {}

      console.log(`${BOLD}Updated:${RESET} ${note.title} ${DIM}(${note.id.slice(0, 8)})${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
