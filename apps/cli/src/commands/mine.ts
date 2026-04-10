import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

const TYPE_COLORS: Record<string, string> = {
  feedback: "\x1b[33m",  // yellow
  debug: "\x1b[31m",     // red
  project: "\x1b[34m",   // blue
  user: "\x1b[32m",      // green
  codebase: "\x1b[36m",  // cyan
};

export const mineCommand = new Command("mine")
  .description("Mine conversations for notes (heuristic by default, --llm for AI extraction)")
  .option("--from <platform>", "Platform to mine from (claude-code|cursor|codex|auto)", "auto")
  .option("--since <duration>", "Only mine conversations since (e.g., 2d, 1w, 2026-04-01)")
  .option("--dry-run", "Preview candidates without saving", false)
  .option("--llm", "Use LLM for semantic extraction (requires ANTHROPIC_API_KEY)", false)
  .action(async (opts: { from: string; since?: string; dryRun: boolean; llm: boolean }) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);

      console.log(`${BOLD}Mining conversations...${RESET}`);
      if (opts.dryRun) console.log(`${DIM}(dry run — nothing will be saved)${RESET}`);
      console.log();

      const result = await client.mine({
        platform: opts.from,
        since: opts.since,
        dryRun: opts.dryRun,
        llm: opts.llm,
      });

      if (opts.dryRun) {
        // Display candidates
        const candidates = result.candidates || [];
        if (candidates.length === 0) {
          console.log(`${DIM}No candidates found.${RESET}`);
        } else {
          console.log(`${BOLD}${candidates.length} candidate(s) found:${RESET}\n`);
          for (const c of candidates) {
            const color = TYPE_COLORS[c.type] || "";
            const conf = Math.round((c.confidence || 0) * 100);
            console.log(`  ${color}●${RESET} ${BOLD}${c.title}${RESET}`);
            console.log(`    ${DIM}Type: ${c.type} | Confidence: ${conf}% | Source: ${c.sourceContext || "unknown"}${RESET}`);
            if (c.preview) {
              const preview = c.preview.slice(0, 120).replace(/\n/g, " ");
              console.log(`    ${DIM}${preview}${RESET}`);
            }
            console.log();
          }
        }
        console.log(`${DIM}Conversations parsed: ${result.conversationsParsed || 0}${RESET}`);
        console.log(`${DIM}Platforms scanned: ${(result.platformsScanned || []).join(", ")}${RESET}`);
      } else {
        // Display save results
        console.log(`${GREEN}✓${RESET} Saved ${BOLD}${result.saved || 0}${RESET} notes`);
        if (result.skipped > 0) {
          console.log(`${DIM}  Skipped ${result.skipped} (already exist)${RESET}`);
        }
        console.log(`${DIM}Conversations parsed: ${result.conversationsParsed || 0}${RESET}`);
        console.log(`${DIM}Platforms scanned: ${(result.platformsScanned || []).join(", ")}${RESET}`);
      }
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
