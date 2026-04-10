import { describe, test, expect } from "bun:test";
import { buildContextFtsQuery } from "../context";

describe("buildContextFtsQuery", () => {
  test("empty string returns empty quote pair", () => {
    expect(buildContextFtsQuery("")).toBe('""');
  });

  test("whitespace-only returns empty quote pair", () => {
    expect(buildContextFtsQuery("   ")).toBe('""');
  });

  test("simple words become individually quoted and OR-joined", () => {
    expect(buildContextFtsQuery("foo bar")).toBe('"foo" OR "bar"');
  });

  test("single unquoted word is quoted", () => {
    expect(buildContextFtsQuery("typescript")).toBe('"typescript"');
  });

  test("quoted phrase is preserved as FTS5 phrase", () => {
    expect(buildContextFtsQuery('"fix login"')).toBe('"fix login"');
  });

  test("quoted phrase + unquoted word: phrase first, then word quoted", () => {
    expect(buildContextFtsQuery('"fix login" bug')).toBe('"fix login" OR "bug"');
  });

  test("only quoted phrases — returned as-is OR-joined", () => {
    expect(buildContextFtsQuery('"auth flow" "jwt token"')).toBe('"auth flow" OR "jwt token"');
  });

  test("mixed quoted + unquoted — phrases first, then individual words", () => {
    const result = buildContextFtsQuery('"react hooks" useState effect');
    expect(result).toBe('"react hooks" OR "useState" OR "effect"');
  });

  test("FTS5 operators in unquoted portion are stripped", () => {
    // The * and - are stripped from unquoted text
    const result = buildContextFtsQuery("foo* bar-baz");
    expect(result).toContain('"foo"');
    // bar and baz split since - is stripped to space
    expect(result).toContain('"bar"');
    expect(result).toContain('"baz"');
  });

  test("quoted phrase content is preserved verbatim (not sanitized)", () => {
    expect(buildContextFtsQuery('"fix the bug"')).toBe('"fix the bug"');
  });
});
