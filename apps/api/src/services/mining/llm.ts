import type { Extractor, ExtractedCandidate, Conversation } from "./types";
import { heuristicExtractor } from "./heuristic";

export const llmExtractor: Extractor = {
  extract(conversations: Conversation[]): ExtractedCandidate[] {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn("[mining] No ANTHROPIC_API_KEY set, falling back to heuristic extraction");
      return heuristicExtractor.extract(conversations);
    }

    // TODO Wave 2: Implement actual LLM extraction using Haiku
    // For now, use heuristic as base
    console.warn("[mining] LLM extraction not yet implemented, using heuristic fallback");
    return heuristicExtractor.extract(conversations);
  },
};
