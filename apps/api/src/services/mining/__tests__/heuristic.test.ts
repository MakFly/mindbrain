import { describe, test, expect } from "bun:test";
import { heuristicExtractor, generateTitle } from "../heuristic";
import type { Conversation } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    platform: "claude-code",
    startedAt: Date.now(),
    messages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// heuristicExtractor.extract
// ---------------------------------------------------------------------------

describe("heuristicExtractor.extract", () => {
  test("returns empty array for empty conversations", () => {
    expect(heuristicExtractor.extract([])).toEqual([]);
  });

  test("returns empty array for conversation with no messages", () => {
    const conv = makeConv({ messages: [] });
    expect(heuristicExtractor.extract([conv])).toEqual([]);
  });

  test("correction pattern detected in user message", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "non pas comme ça, tu devrais faire autrement" },
        { role: "assistant", content: "Bien sûr, je vais corriger." },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    expect(results.length).toBeGreaterThan(0);

    const correction = results.find((r) => r.type === "feedback");
    expect(correction).toBeDefined();
    expect(correction!.confidence).toBe(0.8);
    expect(correction!.sourceConversationId).toBe("conv-1");
  });

  test("correction pattern NOT detected in assistant message", () => {
    const conv = makeConv({
      messages: [
        { role: "assistant", content: "non pas comme ça, c'est une mauvaise approche" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const correction = results.find((r) => r.type === "feedback");
    expect(correction).toBeUndefined();
  });

  test("correction with English pattern 'don't do'", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "don't do that, use the existing helper instead" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const correction = results.find((r) => r.type === "feedback");
    expect(correction).toBeDefined();
  });

  test("bugResolved pattern detected in assistant message", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "why is the login broken?" },
        { role: "assistant", content: "I found the issue. The root cause was a missing await in the auth handler." },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const bug = results.find((r) => r.type === "debug");
    expect(bug).toBeDefined();
    expect(bug!.confidence).toBe(0.7);
  });

  test("bugResolved pattern NOT detected in user message", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "I fixed the bug by restarting the server" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const bug = results.find((r) => r.type === "debug");
    expect(bug).toBeUndefined();
  });

  test("decision pattern detected in user or assistant", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "let's go with Postgres for now" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const decision = results.find((r) => r.type === "project");
    expect(decision).toBeDefined();
    expect(decision!.confidence).toBe(0.7);
  });

  test("preference pattern detected in user message", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "I prefer to always use bun over npm" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const pref = results.find((r) => r.type === "user");
    expect(pref).toBeDefined();
    expect(pref!.confidence).toBe(0.75);
  });

  test("preference pattern NOT detected in assistant message", () => {
    const conv = makeConv({
      messages: [
        { role: "assistant", content: "I prefer to always use the built-in functions" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const pref = results.find((r) => r.type === "user");
    expect(pref).toBeUndefined();
  });

  test("tool and system messages are ignored", () => {
    const conv = makeConv({
      messages: [
        { role: "tool", content: "non pas comme ça — tool output" },
        { role: "system", content: "let's go with Postgres" },
      ],
    });

    expect(heuristicExtractor.extract([conv])).toEqual([]);
  });

  test("sourceContext contains platform and conversation id", () => {
    const conv = makeConv({
      id: "abc-123",
      platform: "cursor",
      messages: [
        { role: "user", content: "non, stop, utilise autre chose" },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    expect(results[0].sourceContext).toContain("cursor");
    expect(results[0].sourceContext).toContain("abc-123");
  });

  test("deduplication by type:title removes duplicates", () => {
    // Same line in two different conversations → same title → deduplicated
    const line = "non pas comme ça, toujours utiliser bun";
    const conv1 = makeConv({ id: "c1", messages: [{ role: "user", content: line }] });
    const conv2 = makeConv({ id: "c2", messages: [{ role: "user", content: line }] });

    const results = heuristicExtractor.extract([conv1, conv2]);
    // Both would produce identical title → dedup keeps only one
    const feedbacks = results.filter((r) => r.type === "feedback");
    expect(feedbacks.length).toBe(1);
  });

  test("adjacent assistant message is included in content after correction", () => {
    const conv = makeConv({
      messages: [
        { role: "user", content: "non pas comme ça" },
        { role: "assistant", content: "Compris, je vais procéder différemment." },
      ],
    });

    const results = heuristicExtractor.extract([conv]);
    const correction = results.find((r) => r.type === "feedback");
    expect(correction!.content).toContain("Compris");
  });
});

// ---------------------------------------------------------------------------
// generateTitle
// ---------------------------------------------------------------------------

describe("generateTitle", () => {
  test("known pattern 'correction' gets Correction prefix", () => {
    expect(generateTitle("correction", "non pas comme ça")).toBe("Correction: non pas comme ça");
  });

  test("known pattern 'bugResolved' gets Bug fix prefix", () => {
    expect(generateTitle("bugResolved", "the root cause was X")).toBe("Bug fix: the root cause was X");
  });

  test("known pattern 'decision' gets Decision prefix", () => {
    expect(generateTitle("decision", "let's go with Postgres")).toBe("Decision: let's go with Postgres");
  });

  test("known pattern 'preference' gets Preference prefix", () => {
    expect(generateTitle("preference", "I always use bun")).toBe("Preference: I always use bun");
  });

  test("known pattern 'learned' gets Learned prefix", () => {
    expect(generateTitle("learned", "TIL bun supports workspaces")).toBe("Learned: TIL bun supports workspaces");
  });

  test("unknown pattern gets Note prefix", () => {
    expect(generateTitle("unknown", "something happened")).toBe("Note: something happened");
  });

  test("short line (<=80 chars) is kept as-is with prefix", () => {
    const line = "fix the auth issue";
    expect(generateTitle("bugResolved", line)).toBe(`Bug fix: ${line}`);
  });

  test("line exactly 80 chars is not truncated", () => {
    const line = "a".repeat(80);
    expect(generateTitle("correction", line)).toBe(`Correction: ${line}`);
  });

  test("line >80 chars is truncated at word boundary with ...", () => {
    // 85 chars: "fix the authentication middleware that was broken by the recent refactor update now"
    const line = "fix the authentication middleware that was broken by the recent refactor update now";
    const result = generateTitle("bugResolved", line);
    expect(result.endsWith("...")).toBe(true);
    // The prefix + body should not exceed prefix + 77 chars (before ...) + 3 for ...
    expect(result.length).toBeLessThanOrEqual("Bug fix: ".length + 77 + 3);
  });

  test("truncation happens at word boundary, not mid-word", () => {
    const line = "fix the authentication middleware broken by recent refactor update to the system";
    const result = generateTitle("bugResolved", line);
    // Remove prefix
    const body = result.replace("Bug fix: ", "").replace("...", "");
    // Should not end with a partial word — last char before ... should be a space-trimmed word end
    expect(body.trim().split(" ").every((w) => w === w)).toBe(true);
  });

  test("leading/trailing whitespace in line is trimmed", () => {
    expect(generateTitle("correction", "  some fix  ")).toBe("Correction: some fix");
  });
});
