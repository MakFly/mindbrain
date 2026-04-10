import type { Extractor, ExtractedCandidate, Conversation } from "./types";
import { heuristicExtractor } from "./heuristic";
import Anthropic from "@anthropic-ai/sdk";
import type { NoteType } from "@mindbrain/shared";

// Maximum conversations per API call to control cost
const BATCH_SIZE = 5;
// Delay between API calls in ms (rate limiting)
const INTER_CALL_DELAY_MS = 500;

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction assistant. Your job is to analyze AI coding assistant conversations and extract valuable knowledge worth saving.

For each conversation, identify items that fall into these categories:
1. **feedback** — corrections from the user ("non", "stop", "wrong approach", "don't do that"), explicit user preferences
2. **debug** — bug fixes with their root cause and solution
3. **project** — architectural decisions, technology choices, design patterns chosen
4. **user** — developer preferences, workflow habits, tools they prefer
5. **codebase** — things learned about the codebase, gotchas, surprising discoveries

Respond with a JSON array of extracted items. Each item must have:
- "title": short descriptive title (max 100 chars)
- "content": the key information extracted (the actual knowledge)
- "type": one of "feedback", "debug", "project", "user", "codebase"
- "confidence": number 0.0–1.0 (how confident you are this is worth saving)
- "sourceContext": a brief quote or reference to where you found this in the conversation

Only extract items with confidence >= 0.6. Return an empty array [] if nothing is worth saving.
Return ONLY the JSON array, no markdown, no explanation.`;

function formatConversationsForPrompt(conversations: Conversation[]): string {
  return conversations
    .map((conv, idx) => {
      const msgs = conv.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, 30) // cap per conversation to control token usage
        .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 1000)}`)
        .join("\n\n");

      return `=== CONVERSATION ${idx + 1} (id: ${conv.id}, platform: ${conv.platform}) ===\n${msgs}`;
    })
    .join("\n\n---\n\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractBatch(
  client: Anthropic,
  conversations: Conversation[]
): Promise<ExtractedCandidate[]> {
  const prompt = formatConversationsForPrompt(conversations);

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract knowledge from these ${conversations.length} conversation(s):\n\n${prompt}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

  // Find JSON array in the response (handle potential whitespace/wrapping)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn("[mining/llm] Failed to parse LLM response as JSON");
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const validTypes = new Set<NoteType>(["feedback", "debug", "project", "user", "codebase"]);

  // Attach source conversation IDs round-robin (LLM may not always include them precisely)
  return parsed
    .filter(
      (item: any) =>
        item &&
        typeof item.title === "string" &&
        typeof item.content === "string" &&
        validTypes.has(item.type) &&
        typeof item.confidence === "number" &&
        item.confidence >= 0.6
    )
    .map((item: any, i: number): ExtractedCandidate => {
      // Try to match source conversation by index hint in sourceContext
      const sourceConv = conversations[i % conversations.length];
      return {
        title: String(item.title).slice(0, 120),
        content: String(item.content),
        type: item.type as NoteType,
        confidence: Math.min(1, Math.max(0, Number(item.confidence))),
        sourceConversationId: sourceConv.id,
        sourceContext: String(item.sourceContext || `${sourceConv.platform}:${sourceConv.id}`),
      };
    });
}

export const llmExtractor: Extractor = {
  extract(conversations: Conversation[]): ExtractedCandidate[] {
    // Synchronous interface — kick off async and return heuristic results immediately.
    // Callers that want LLM results should use extractAsync instead.
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn("[mining/llm] No ANTHROPIC_API_KEY set, falling back to heuristic extraction");
      return heuristicExtractor.extract(conversations);
    }

    console.warn(
      "[mining/llm] llmExtractor.extract() called synchronously — use llmExtractor.extractAsync() for LLM results. Returning heuristic results now."
    );
    return heuristicExtractor.extract(conversations);
  },

  async extractAsync(conversations: Conversation[]): Promise<ExtractedCandidate[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn("[mining/llm] No ANTHROPIC_API_KEY set, falling back to heuristic extraction");
      return heuristicExtractor.extract(conversations);
    }

    if (conversations.length === 0) return [];

    const client = new Anthropic({ apiKey });
    const allCandidates: ExtractedCandidate[] = [];

    // Process in batches of BATCH_SIZE, sequentially to respect rate limits
    for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
      const batch = conversations.slice(i, i + BATCH_SIZE);

      try {
        const candidates = await extractBatch(client, batch);
        allCandidates.push(...candidates);
      } catch (err: any) {
        console.warn(
          `[mining/llm] LLM extraction failed for batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err?.message ?? err}`
        );
        // Fall back to heuristic for this batch
        const fallback = heuristicExtractor.extract(batch);
        allCandidates.push(...fallback);
      }

      // Rate limit delay between batches (skip after last batch)
      if (i + BATCH_SIZE < conversations.length) {
        await sleep(INTER_CALL_DELAY_MS);
      }
    }

    // Deduplicate by type:title (same as heuristic extractor)
    const seen = new Set<string>();
    return allCandidates.filter((c) => {
      const key = `${c.type}:${c.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
} as Extractor & { extractAsync(conversations: Conversation[]): Promise<ExtractedCandidate[]> };
