import { describe, test, expect } from "bun:test";
import { sanitizeFtsQuery } from "../search";

describe("sanitizeFtsQuery", () => {
  test("empty string returns empty quote pair", () => {
    expect(sanitizeFtsQuery("")).toBe('""');
  });

  test("whitespace-only returns empty quote pair", () => {
    expect(sanitizeFtsQuery("   ")).toBe('""');
    expect(sanitizeFtsQuery("\t\n")).toBe('""');
  });

  test("single word is wrapped in quotes", () => {
    expect(sanitizeFtsQuery("hello")).toBe('"hello"');
  });

  test("multiple words are each quoted and joined with OR", () => {
    expect(sanitizeFtsQuery("foo bar")).toBe('"foo" OR "bar"');
    expect(sanitizeFtsQuery("one two three")).toBe('"one" OR "two" OR "three"');
  });

  test("FTS5 special chars are stripped: *", () => {
    expect(sanitizeFtsQuery("foo*")).toBe('"foo"');
  });

  test("FTS5 special chars are stripped: ():^{}~-+<>", () => {
    const result = sanitizeFtsQuery("(foo):bar^baz{}~qux-quux+corge<grault>");
    // All special chars removed, remaining words quoted
    expect(result).toContain('"foo"');
    expect(result).toContain('"bar"');
    expect(result).toContain('"baz"');
    // Each token quoted, joined with OR
    const tokens = result.split(" OR ");
    expect(tokens.every((t) => t.startsWith('"') && t.endsWith('"'))).toBe(true);
  });

  test("special chars mixed with words — words survive and are quoted", () => {
    expect(sanitizeFtsQuery("fix* (bug)")).toBe('"fix" OR "bug"');
  });

  test("extra internal whitespace is collapsed", () => {
    expect(sanitizeFtsQuery("foo   bar")).toBe('"foo" OR "bar"');
  });

  // Phrase search tests
  test("quoted phrase is preserved as FTS5 phrase match", () => {
    expect(sanitizeFtsQuery('"auth flow"')).toBe('"auth flow"');
  });

  test("quoted phrase mixed with unquoted word", () => {
    expect(sanitizeFtsQuery('"auth flow" bug')).toBe('"auth flow" OR "bug"');
  });

  test("multiple quoted phrases joined with OR", () => {
    expect(sanitizeFtsQuery('"auth flow" "login page"')).toBe(
      '"auth flow" OR "login page"'
    );
  });

  test("quoted phrase mixed with multiple unquoted words", () => {
    const result = sanitizeFtsQuery('"auth flow" bug fix');
    expect(result).toContain('"auth flow"');
    expect(result).toContain('"bug"');
    expect(result).toContain('"fix"');
    expect(result.split(" OR ")).toHaveLength(3);
  });

  test("empty quoted phrase is ignored", () => {
    expect(sanitizeFtsQuery('""')).toBe('""');
  });

  test("quoted phrase with only spaces is ignored, falls back to unquoted words", () => {
    expect(sanitizeFtsQuery('"  " hello')).toBe('"hello"');
  });
});
