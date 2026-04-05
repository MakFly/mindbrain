import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const linksCommand = new Command("links")
  .description("Show backlinks for a note")
  .argument("<id>", "Note ID")
  .action(async (id: string) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const result = await client.backlinks(id);

      const links = Array.isArray(result) ? result : result.backlinks || result.notes || [];

      if (links.length === 0) {
        console.log(`${DIM}No backlinks found.${RESET}`);
        return;
      }

      console.log(`${BOLD}Backlinks for ${id.slice(0, 8)}${RESET}\n`);

      for (const link of links) {
        const linkId = (link.id || link.sourceId || "").slice(0, 8);
        const title = link.title || link.label || "—";
        const type = link.type || "";
        console.log(`  ${BOLD}${linkId}${RESET}  ${title}  ${DIM}${type}${RESET}`);
      }

      console.log(`\n${DIM}${links.length} backlink(s)${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
