import type { Conversation, ExtractedCandidate, PlatformParser } from "./types";
import type { PlatformType } from "@mindbrain/shared";
import { claudeCodeParser } from "./parsers/claude-code";
import { cursorParser } from "./parsers/cursor";
import { codexParser } from "./parsers/codex";
import { heuristicExtractor } from "./heuristic";
import { llmExtractor } from "./llm";

const parsers: Record<PlatformType, PlatformParser> = {
  "claude-code": claudeCodeParser,
  cursor: cursorParser,
  codex: codexParser,
  gemini: codexParser, // Reuse codex stub for now
};

interface MineOpts {
  platform: PlatformType | "auto";
  since?: string; // "2d", "1w", "2026-04-01", etc.
  dryRun?: boolean;
  llm?: boolean;
}

interface MineResult {
  candidates: ExtractedCandidate[];
  conversationsParsed: number;
  platformsScanned: string[];
}

function parseSince(since?: string): Date | undefined {
  if (!since) return undefined;

  // Relative duration: "2d", "1w", "3h"
  const relMatch = since.match(/^(\d+)([dhwm])$/);
  if (relMatch) {
    const amount = parseInt(relMatch[1]);
    const unit = relMatch[2];
    const now = Date.now();
    const ms: Record<string, number> = {
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
      m: 2_592_000_000, // ~30 days
    };
    return new Date(now - amount * (ms[unit] ?? 86_400_000));
  }

  // Absolute date
  const date = new Date(since);
  if (!isNaN(date.getTime())) return date;

  return undefined;
}

export async function mine(opts: MineOpts): Promise<MineResult> {
  const sinceDate = parseSince(opts.since);

  // Determine which platforms to scan
  let platformsToScan: PlatformType[];

  if (opts.platform === "auto") {
    const detected: PlatformType[] = [];
    for (const [name, parser] of Object.entries(parsers)) {
      if (await parser.detect()) {
        detected.push(name as PlatformType);
      }
    }
    platformsToScan = detected;
  } else {
    platformsToScan = [opts.platform];
  }

  // Parse conversations from all platforms
  const allConversations: Conversation[] = [];

  for (const platform of platformsToScan) {
    const parser = parsers[platform];
    const conversations = await parser.parse({ since: sinceDate });
    allConversations.push(...conversations);
  }

  // Extract candidates
  const extractor = opts.llm ? llmExtractor : heuristicExtractor;
  const candidates = extractor.extract(allConversations);

  return {
    candidates,
    conversationsParsed: allConversations.length,
    platformsScanned: platformsToScan,
  };
}
