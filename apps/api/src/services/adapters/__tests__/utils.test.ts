import { describe, test, expect } from "bun:test";
import { parseFrontmatter } from "../utils";

describe("parseFrontmatter", () => {
  test("no frontmatter returns empty object and full body", () => {
    const raw = "just plain text\nno frontmatter here";
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(body).toBe(raw);
  });

  test("valid YAML frontmatter with string values is parsed", () => {
    const raw = `---\ntitle: Hello World\nauthor: Alice\n---\nBody content here.`;
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({ title: "Hello World", author: "Alice" });
    expect(body).toBe("Body content here.");
  });

  test("YAML array [a, b, c] is parsed into an array", () => {
    const raw = `---\ntags: [typescript, bun, testing]\n---\nSome body.`;
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.tags).toEqual(["typescript", "bun", "testing"]);
    expect(body).toBe("Some body.");
  });

  test("YAML array with quoted items strips the quotes", () => {
    const raw = `---\nkeywords: ["foo", "bar", "baz"]\n---\n`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.keywords).toEqual(["foo", "bar", "baz"]);
  });

  test("quoted string values have quotes stripped", () => {
    const raw = `---\ntitle: "My Title"\n---\nBody.`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.title).toBe("My Title");
  });

  test("single-quoted values have quotes stripped", () => {
    const raw = `---\ntitle: 'My Title'\n---\nBody.`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.title).toBe("My Title");
  });

  test("empty body after frontmatter returns empty string", () => {
    const raw = `---\ntitle: Test\n---\n`;
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.title).toBe("Test");
    expect(body).toBe("");
  });

  test("Windows line endings (\\r\\n) are handled", () => {
    const raw = "---\r\ntitle: Hello\r\nauthor: Bob\r\n---\r\nWindows body.";
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.title).toBe("Hello");
    expect(frontmatter.author).toBe("Bob");
    expect(body).toBe("Windows body.");
  });

  test("value with colon in it — only first colon is the separator", () => {
    const raw = `---\nurl: https://example.com/path\n---\nBody.`;
    const { frontmatter } = parseFrontmatter(raw);
    // key = "url", value = "https://example.com/path"
    expect(frontmatter.url).toBe("https://example.com/path");
  });

  test("line without colon in frontmatter is skipped", () => {
    const raw = `---\ntitle: Valid\nno-colon-line\n---\nBody.`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.title).toBe("Valid");
    expect(Object.keys(frontmatter)).toEqual(["title"]);
  });

  test("multiple frontmatter fields all parsed correctly", () => {
    const raw = `---\ntitle: Note\ntype: feedback\nconfidence: 0.9\ntags: [a, b]\n---\nContent.`;
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.title).toBe("Note");
    expect(frontmatter.type).toBe("feedback");
    expect(frontmatter.confidence).toBe("0.9");
    expect(frontmatter.tags).toEqual(["a", "b"]);
    expect(body).toBe("Content.");
  });
});
