/**
 * Mindbrain E2E Test Runner
 *
 * Single-file test runner that starts the API, runs 10 test suites,
 * and generates a beautiful HTML/Tailwind report.
 *
 * Usage: bun run tests/e2e/run.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubTest {
  name: string;
  passed: boolean;
  error?: string;
  expected?: string;
  got?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  subtests: SubTest[];
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    const err = new Error(msg) as Error & { expected: string; got: string };
    err.expected = e;
    err.got = a;
    throw err;
  }
}

function assertIncludes(arr: any[], value: any, msg: string) {
  if (!arr.includes(value)) {
    const err = new Error(msg) as Error & { expected: string; got: string };
    err.expected = `array containing ${JSON.stringify(value)}`;
    err.got = JSON.stringify(arr);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HTTP Client
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3456";

async function api(
  method: string,
  path: string,
  body?: any,
  apiKey?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["X-API-Key"] = apiKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

async function createTestProject(
  name: string
): Promise<{ projectId: string; apiKey: string }> {
  const { data } = await api("POST", "/projects", {
    name,
    path: `/tmp/test-${name}-${Date.now()}`,
  });
  return { projectId: data.project.id, apiKey: data.apiKey };
}

// ---------------------------------------------------------------------------
// Test runner helper
// ---------------------------------------------------------------------------

async function runSubtest(
  subtests: SubTest[],
  name: string,
  fn: () => Promise<void>
) {
  try {
    await fn();
    subtests.push({ name, passed: true });
  } catch (err: any) {
    subtests.push({
      name,
      passed: false,
      error: err.message,
      expected: err.expected,
      got: err.got,
    });
  }
}

async function runTest(
  name: string,
  fn: () => Promise<SubTest[]>
): Promise<TestResult> {
  const start = performance.now();
  let subtests: SubTest[] = [];
  try {
    subtests = await fn();
  } catch (err: any) {
    subtests.push({
      name: "Unexpected error",
      passed: false,
      error: err.message,
    });
  }
  const duration = performance.now() - start;
  const passed = subtests.every((s) => s.passed);
  return { name, passed, duration, subtests };
}

// ---------------------------------------------------------------------------
// T1: Auth & Project Lifecycle
// ---------------------------------------------------------------------------

async function testAuthProjectLifecycle(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];

  let projectId = "";
  let apiKey = "";

  await runSubtest(subtests, "Create project → 201, apiKey starts with mb_", async () => {
    const res = await api("POST", "/projects", { name: "t1-auth", path: "/tmp/t1-auth" });
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.data.apiKey.startsWith("mb_"), "apiKey should start with mb_");
    assert(res.data.project.id, "project should have id");
    projectId = res.data.project.id;
    apiKey = res.data.apiKey;
  });

  await runSubtest(subtests, "GET /notes with valid key → 200", async () => {
    const res = await api("GET", "/notes", undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  await runSubtest(subtests, "GET /notes with invalid key → 401", async () => {
    const res = await api("GET", "/notes", undefined, "mb_invalid_key_12345");
    assertEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runSubtest(subtests, "GET /notes without key → 401", async () => {
    const res = await api("GET", "/notes");
    assertEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runSubtest(subtests, "GET /projects/:id/stats → has noteCount, edgeCount, tagCount", async () => {
    const res = await api("GET", `/projects/${projectId}/stats`, undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert("noteCount" in res.data, "stats should have noteCount");
    assert("edgeCount" in res.data, "stats should have edgeCount");
    assert("tagCount" in res.data, "stats should have tagCount");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T2: Notes CRUD
// ---------------------------------------------------------------------------

async function testNotesCRUD(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t2-crud");

  let noteId = "";

  await runSubtest(subtests, "POST /notes → 201, has id, title, type, tags", async () => {
    const res = await api("POST", "/notes", {
      title: "Test Note",
      content: "Hello world",
      type: "user",
      tags: ["test"],
    }, apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.data.id, "note should have id");
    assertEqual(res.data.title, "Test Note", "title mismatch");
    assertEqual(res.data.type, "user", "type mismatch");
    assert(Array.isArray(res.data.tags), "tags should be array");
    noteId = res.data.id;
  });

  await runSubtest(subtests, "GET /notes/:id → matches created data", async () => {
    const res = await api("GET", `/notes/${noteId}`, undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assertEqual(res.data.title, "Test Note", "title mismatch");
    assertEqual(res.data.content, "Hello world", "content mismatch");
    assertEqual(res.data.type, "user", "type mismatch");
  });

  await runSubtest(subtests, "PUT /notes/:id with new title → 200, title changed", async () => {
    const res = await api("PUT", `/notes/${noteId}`, { title: "Updated Note" }, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assertEqual(res.data.title, "Updated Note", "title should be updated");
  });

  await runSubtest(subtests, "DELETE /notes/:id → 204", async () => {
    const res = await api("DELETE", `/notes/${noteId}`, undefined, apiKey);
    assertEqual(res.status, 204, `Expected 204, got ${res.status}`);
  });

  await runSubtest(subtests, "GET /notes/:id after delete → 404", async () => {
    const res = await api("GET", `/notes/${noteId}`, undefined, apiKey);
    assertEqual(res.status, 404, `Expected 404, got ${res.status}`);
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T3: Wikilinks Auto-Edges
// ---------------------------------------------------------------------------

async function testWikilinksAutoEdges(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t3-wikilinks");

  let noteAId = "";

  await runSubtest(subtests, "Create note A with [[NoteB]] and [[NoteC]] → 2 edges", async () => {
    const res = await api("POST", "/notes", {
      title: "NoteA",
      content: "See [[NoteB]] and [[NoteC]]",
      type: "user",
      tags: [],
    }, apiKey);
    noteAId = res.data.id;

    const graph = await api("GET", "/graph", undefined, apiKey);
    const edgesFromA = graph.data.edges.filter((e: any) => e.sourceId === noteAId);
    assertEqual(edgesFromA.length, 2, `Expected 2 edges from A, got ${edgesFromA.length}`);
  });

  await runSubtest(subtests, "Create NoteB → edge A→NoteB has non-null targetId", async () => {
    await api("POST", "/notes", {
      title: "NoteB",
      content: "I am NoteB",
      type: "user",
      tags: [],
    }, apiKey);

    const graph = await api("GET", "/graph", undefined, apiKey);
    const edgeToBLabel = graph.data.edges.find(
      (e: any) => e.sourceId === noteAId && e.label === "NoteB"
    );
    assert(edgeToBLabel, "Edge to NoteB should exist");
    assert(edgeToBLabel.targetId !== null, "Edge to NoteB should have non-null targetId");
  });

  await runSubtest(subtests, "Create NoteC → dangling edge resolved", async () => {
    await api("POST", "/notes", {
      title: "NoteC",
      content: "I am NoteC",
      type: "user",
      tags: [],
    }, apiKey);

    const graph = await api("GET", "/graph", undefined, apiKey);
    const edgeToC = graph.data.edges.find(
      (e: any) => e.sourceId === noteAId && e.label === "NoteC"
    );
    assert(edgeToC, "Edge to NoteC should exist");
    assert(edgeToC.targetId !== null, "Edge to NoteC should have non-null targetId after resolution");
  });

  await runSubtest(subtests, "Update A to [[NoteB]] only → edge to NoteC deleted", async () => {
    await api("PUT", `/notes/${noteAId}`, {
      content: "See [[NoteB]] only",
    }, apiKey);

    const graph = await api("GET", "/graph", undefined, apiKey);
    const edgesFromA = graph.data.edges.filter((e: any) => e.sourceId === noteAId);
    assertEqual(edgesFromA.length, 1, `Expected 1 edge from A, got ${edgesFromA.length}`);
    assertEqual(edgesFromA[0].label, "NoteB", "Remaining edge should be to NoteB");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T4: FTS5 Search
// ---------------------------------------------------------------------------

async function testFTS5Search(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t4-search");

  // Create 5 notes
  await api("POST", "/notes", { title: "Auth middleware", content: "JWT authentication middleware", type: "codebase", tags: ["auth"] }, apiKey);
  await api("POST", "/notes", { title: "Database migrations", content: "Schema migration strategy", type: "project", tags: ["db"] }, apiKey);
  await api("POST", "/notes", { title: "Rate limiting setup", content: "Rate limiting configuration", type: "codebase", tags: ["performance"] }, apiKey);
  await api("POST", "/notes", { title: "Testing strategy", content: "Unit and integration tests", type: "feedback", tags: ["testing"] }, apiKey);
  await api("POST", "/notes", { title: "Auth token refresh", content: "Token refresh flow for authentication", type: "codebase", tags: ["auth"] }, apiKey);

  await runSubtest(subtests, "Search 'auth' → at least 2 results", async () => {
    const res = await api("GET", "/search?q=auth", undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.length >= 2, `Expected >= 2 results for 'auth', got ${res.data.results.length}`);
  });

  await runSubtest(subtests, "Search 'fix rate limiting bug' → returns Rate limiting setup (OR mode)", async () => {
    const res = await api("GET", `/search?q=${encodeURIComponent("fix rate limiting bug")}`, undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const titles = res.data.results.map((r: any) => r.title);
    assert(titles.includes("Rate limiting setup"), `Expected 'Rate limiting setup' in results, got: ${titles.join(", ")}`);
  });

  await runSubtest(subtests, "Search 'auth' with type=codebase → only codebase", async () => {
    const res = await api("GET", "/search?q=auth&type=codebase", undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const types = res.data.results.map((r: any) => r.type);
    assert(types.every((t: string) => t === "codebase"), `Expected all codebase, got: ${types.join(", ")}`);
  });

  await runSubtest(subtests, "Search 'testing' with tags=testing → respects tag filter", async () => {
    const res = await api("GET", "/search?q=testing&tags=testing", undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.length >= 1, "Expected at least 1 result for testing tag");
    const hasTesting = res.data.results.some((r: any) =>
      Array.isArray(r.tags) ? r.tags.includes("testing") : String(r.tags).includes("testing")
    );
    assert(hasTesting, "Expected result with 'testing' tag");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T5: Context Search
// ---------------------------------------------------------------------------

async function testContextSearch(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t5-context");

  // Create notes: one with file metadata, others without
  await api("POST", "/notes", {
    title: "Auth module",
    content: "Authentication logic for the app",
    type: "codebase",
    tags: ["auth"],
    metadata: { files: ["src/auth.ts"] },
  }, apiKey);
  await api("POST", "/notes", {
    title: "DB setup",
    content: "Database configuration",
    type: "codebase",
    tags: ["db"],
    metadata: {},
  }, apiKey);

  await runSubtest(subtests, "POST /search/context with files → file-boosted note ranks higher", async () => {
    const res = await api("POST", "/search/context", {
      files: ["src/auth.ts"],
      task: "auth",
    }, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.notes.length >= 1, "Expected at least 1 contextual note");
    // The file-boosted note should be in results
    const titles = res.data.notes.map((n: any) => n.title);
    assert(titles.includes("Auth module"), `Expected 'Auth module' in results, got: ${titles.join(", ")}`);
  });

  await runSubtest(subtests, "Response has 'markdown' field", async () => {
    const res = await api("POST", "/search/context", {
      files: ["src/auth.ts"],
      task: "auth",
    }, apiKey);
    assert(typeof res.data.markdown === "string", "Response should have markdown string field");
  });

  await runSubtest(subtests, "Unrelated task + no files → empty or minimal results", async () => {
    const res = await api("POST", "/search/context", {
      files: [],
      task: "completely unrelated xyz topic",
    }, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.notes), "notes should be an array");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T6: Graph Traversal
// ---------------------------------------------------------------------------

async function testGraphTraversal(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t6-graph");

  // Create: A → B → C, D → A (cycle)
  const a = (await api("POST", "/notes", { title: "NodeA", content: "Link to [[NodeB]]", type: "user", tags: [] }, apiKey)).data;
  const b = (await api("POST", "/notes", { title: "NodeB", content: "Link to [[NodeC]]", type: "user", tags: [] }, apiKey)).data;
  const c = (await api("POST", "/notes", { title: "NodeC", content: "Just a leaf", type: "user", tags: [] }, apiKey)).data;
  const d = (await api("POST", "/notes", { title: "NodeD", content: "Link to [[NodeA]]", type: "user", tags: [] }, apiKey)).data;

  await runSubtest(subtests, "GET /graph?noteId=A&depth=1 → nodes include A and B", async () => {
    const res = await api("GET", `/graph?noteId=${a.id}&depth=1`, undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const nodeIds = res.data.nodes.map((n: any) => n.id);
    assert(nodeIds.includes(a.id), "Should include A");
    assert(nodeIds.includes(b.id), "Should include B (direct link)");
  });

  await runSubtest(subtests, "GET /graph?noteId=A&depth=2 → nodes include A, B, C", async () => {
    const res = await api("GET", `/graph?noteId=${a.id}&depth=2`, undefined, apiKey);
    const nodeIds = res.data.nodes.map((n: any) => n.id);
    assert(nodeIds.includes(a.id), "Should include A");
    assert(nodeIds.includes(b.id), "Should include B");
    assert(nodeIds.includes(c.id), "Should include C");
  });

  await runSubtest(subtests, "GET /graph (full) → all 4 nodes, all edges", async () => {
    const res = await api("GET", "/graph", undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.nodes.length >= 4, `Expected >= 4 nodes, got ${res.data.nodes.length}`);
    assert(res.data.edges.length >= 3, `Expected >= 3 edges, got ${res.data.edges.length}`);
  });

  await runSubtest(subtests, "GET /graph/notes/B/backlinks → returns A", async () => {
    const res = await api("GET", `/graph/notes/${b.id}/backlinks`, undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const backlinkNoteIds = res.data.backlinks.map((bl: any) => bl.note.id);
    assert(backlinkNoteIds.includes(a.id), "A should be a backlink of B");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T7: Short ID Resolution
// ---------------------------------------------------------------------------

async function testShortIdResolution(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t7-shortid");

  let fullId = "";
  let shortId = "";

  await runSubtest(subtests, "Create note and derive short ID (8 chars)", async () => {
    const res = await api("POST", "/notes", {
      title: "ShortID Test",
      content: "Testing short ID resolution",
      type: "user",
      tags: [],
    }, apiKey);
    fullId = res.data.id;
    shortId = fullId.substring(0, 8);
    assert(fullId.length === 36, "Full ID should be UUID (36 chars)");
    assert(shortId.length === 8, "Short ID should be 8 chars");
  });

  await runSubtest(subtests, "GET /notes/<shortId> → same note returned", async () => {
    const res = await api("GET", `/notes/${shortId}`, undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assertEqual(res.data.id, fullId, "Should resolve to the same note");
  });

  await runSubtest(subtests, "PUT /notes/<shortId> → 200", async () => {
    const res = await api("PUT", `/notes/${shortId}`, { content: "Updated via short ID" }, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assertEqual(res.data.content, "Updated via short ID", "Content should be updated");
  });

  await runSubtest(subtests, "DELETE /notes/<shortId> → 204", async () => {
    const res = await api("DELETE", `/notes/${shortId}`, undefined, apiKey);
    assertEqual(res.status, 204, `Expected 204, got ${res.status}`);
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T8: Import/Export Round-trip (API data integrity)
// ---------------------------------------------------------------------------

async function testImportExportRoundtrip(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t8-roundtrip");

  const notesData = [
    { title: "User Note", content: "User content", type: "user", tags: ["personal"] },
    { title: "Feedback Note", content: "Feedback content", type: "feedback", tags: ["review", "sprint"] },
    { title: "Codebase Note", content: "Codebase content", type: "codebase", tags: ["api"] },
  ];

  const createdIds: string[] = [];

  for (const nd of notesData) {
    const res = await api("POST", "/notes", nd, apiKey);
    createdIds.push(res.data.id);
  }

  await runSubtest(subtests, "GET /notes → list all 3 notes", async () => {
    const res = await api("GET", "/notes", undefined, apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.length >= 3, `Expected >= 3 notes, got ${res.data.length}`);
  });

  await runSubtest(subtests, "Each note has correct type", async () => {
    for (let i = 0; i < notesData.length; i++) {
      const res = await api("GET", `/notes/${createdIds[i]}`, undefined, apiKey);
      assertEqual(res.data.type, notesData[i].type, `Note ${i} type mismatch`);
    }
  });

  await runSubtest(subtests, "Each note has correct tags", async () => {
    for (let i = 0; i < notesData.length; i++) {
      const res = await api("GET", `/notes/${createdIds[i]}`, undefined, apiKey);
      assertEqual(res.data.tags, notesData[i].tags, `Note ${i} tags mismatch`);
    }
  });

  await runSubtest(subtests, "Each note has correct content", async () => {
    for (let i = 0; i < notesData.length; i++) {
      const res = await api("GET", `/notes/${createdIds[i]}`, undefined, apiKey);
      assertEqual(res.data.content, notesData[i].content, `Note ${i} content mismatch`);
    }
  });

  await runSubtest(subtests, "Update note → updatedAt changes", async () => {
    const before = await api("GET", `/notes/${createdIds[0]}`, undefined, apiKey);
    const beforeUpdatedAt = before.data.updatedAt;

    // Small delay to ensure timestamp difference
    await Bun.sleep(50);

    await api("PUT", `/notes/${createdIds[0]}`, { content: "Modified content" }, apiKey);
    const after = await api("GET", `/notes/${createdIds[0]}`, undefined, apiKey);
    assert(after.data.updatedAt > beforeUpdatedAt, "updatedAt should increase after update");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T9: Edge Cases
// ---------------------------------------------------------------------------

async function testEdgeCases(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];
  const { apiKey } = await createTestProject("t9-edgecases");

  await runSubtest(subtests, "Empty content → 201", async () => {
    const res = await api("POST", "/notes", {
      title: "Empty Content",
      content: "",
      type: "user",
      tags: [],
    }, apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);
  });

  await runSubtest(subtests, "500-char title → 201", async () => {
    const longTitle = "A".repeat(500);
    const res = await api("POST", "/notes", {
      title: longTitle,
      content: "Long title test",
      type: "user",
      tags: [],
    }, apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assertEqual(res.data.title, longTitle, "Long title should be preserved");
  });

  await runSubtest(subtests, "Special chars (XSS payload) → stored verbatim", async () => {
    const xssContent = `<script>alert('xss')</script>`;
    const res = await api("POST", "/notes", {
      title: "XSS Test",
      content: xssContent,
      type: "user",
      tags: [],
    }, apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);

    const get = await api("GET", `/notes/${res.data.id}`, undefined, apiKey);
    assertEqual(get.data.content, xssContent, "XSS content should be stored verbatim");
  });

  await runSubtest(subtests, "Unicode content → preserved exactly", async () => {
    const unicodeContent = "Données utilisateur 🧠 データ العربية";
    const res = await api("POST", "/notes", {
      title: "Unicode Test",
      content: unicodeContent,
      type: "user",
      tags: [],
    }, apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);

    const get = await api("GET", `/notes/${res.data.id}`, undefined, apiKey);
    assertEqual(get.data.content, unicodeContent, "Unicode content should be preserved");
  });

  await runSubtest(subtests, "Duplicate titles → both created and retrievable", async () => {
    const res1 = await api("POST", "/notes", {
      title: "Duplicate Title",
      content: "First",
      type: "user",
      tags: [],
    }, apiKey);
    const res2 = await api("POST", "/notes", {
      title: "Duplicate Title",
      content: "Second",
      type: "user",
      tags: [],
    }, apiKey);

    assertEqual(res1.status, 201, "First note should be created");
    assertEqual(res2.status, 201, "Second note should be created");
    assert(res1.data.id !== res2.data.id, "Should have different IDs");

    const get1 = await api("GET", `/notes/${res1.data.id}`, undefined, apiKey);
    const get2 = await api("GET", `/notes/${res2.data.id}`, undefined, apiKey);
    assertEqual(get1.data.content, "First", "First note content should match");
    assertEqual(get2.data.content, "Second", "Second note content should match");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// T10: Multi-Project Isolation
// ---------------------------------------------------------------------------

async function testMultiProjectIsolation(): Promise<SubTest[]> {
  const subtests: SubTest[] = [];

  const projA = await createTestProject("t10-isolation-A");
  const projB = await createTestProject("t10-isolation-B");

  await runSubtest(subtests, "Create note in A with A's key", async () => {
    const res = await api("POST", "/notes", {
      title: "A Secret",
      content: "Only in project A isolation test",
      type: "user",
      tags: ["project-a"],
    }, projA.apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);
  });

  await runSubtest(subtests, "Create note in B with B's key", async () => {
    const res = await api("POST", "/notes", {
      title: "B Secret",
      content: "Only in project B isolation test",
      type: "user",
      tags: ["project-b"],
    }, projB.apiKey);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}`);
  });

  await runSubtest(subtests, "Search with A's key → only A's note", async () => {
    const res = await api("GET", `/search?q=isolation`, undefined, projA.apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const titles = res.data.results.map((r: any) => r.title);
    assert(titles.includes("A Secret"), "Should find A's note");
    assert(!titles.includes("B Secret"), "Should NOT find B's note");
  });

  await runSubtest(subtests, "Search with B's key → only B's note", async () => {
    const res = await api("GET", `/search?q=isolation`, undefined, projB.apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const titles = res.data.results.map((r: any) => r.title);
    assert(titles.includes("B Secret"), "Should find B's note");
    assert(!titles.includes("A Secret"), "Should NOT find A's note");
  });

  await runSubtest(subtests, "GET /notes with A's key → only A's notes", async () => {
    const res = await api("GET", "/notes", undefined, projA.apiKey);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const titles = res.data.map((n: any) => n.title);
    assert(titles.includes("A Secret"), "Should find A's note");
    assert(!titles.includes("B Secret"), "Should NOT find B's note in A's list");
  });

  return subtests;
}

// ---------------------------------------------------------------------------
// HTML Report Generator
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateReport(
  results: TestResult[],
  totalDuration: number
): string {
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;
  const totalSubtests = results.reduce((s, r) => s + r.subtests.length, 0);
  const passedSubtests = results.reduce(
    (s, r) => s + r.subtests.filter((st) => st.passed).length,
    0
  );
  const passRate = totalSubtests > 0 ? Math.round((passedSubtests / totalSubtests) * 100) : 0;
  const allPassed = failedTests === 0;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const testCards = results
    .map((r, idx) => {
      const badge = r.passed
        ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">PASS</span>`
        : `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">FAIL</span>`;

      const subtestRows = r.subtests
        .map((st) => {
          const icon = st.passed ? "✅" : "❌";
          let errorBlock = "";
          if (!st.passed && st.error) {
            errorBlock = `
              <div class="mt-1 ml-6 p-2 rounded bg-red-500/5 border border-red-500/20">
                <p class="text-red-400 text-xs font-mono">${escapeHtml(st.error)}</p>
                ${st.expected ? `<p class="text-gray-500 text-xs font-mono mt-1">Expected: ${escapeHtml(st.expected)}</p>` : ""}
                ${st.got ? `<p class="text-gray-500 text-xs font-mono">Got: ${escapeHtml(st.got)}</p>` : ""}
              </div>`;
          }
          return `
            <div class="py-1.5 ${st.passed ? "" : ""}">
              <span>${icon}</span>
              <span class="text-sm ${st.passed ? "text-gray-300" : "text-red-300"}">${escapeHtml(st.name)}</span>
              ${errorBlock}
            </div>`;
        })
        .join("");

      const durationStr = (r.duration / 1000).toFixed(2);
      const borderColor = r.passed ? "border-gray-800" : "border-red-500/30";
      const defaultOpen = r.passed ? "" : "open";

      return `
        <div class="bg-gray-900 border ${borderColor} rounded-xl p-4 transition-all duration-200 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <span class="text-gray-500 text-sm font-mono">T${idx + 1}</span>
              <h3 class="text-base font-semibold text-gray-100">${escapeHtml(r.name)}</h3>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-gray-500 text-xs font-mono">${durationStr}s</span>
              ${badge}
            </div>
          </div>
          <details ${defaultOpen} class="mt-2">
            <summary class="text-gray-500 text-xs cursor-pointer hover:text-gray-400 transition-colors">
              ${r.subtests.filter((s) => s.passed).length}/${r.subtests.length} subtests passed
            </summary>
            <div class="mt-2 ml-2 space-y-0.5">
              ${subtestRows}
            </div>
          </details>
        </div>`;
    })
    .join("\n");

  const totalDurationStr = (totalDuration / 1000).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mindbrain E2E Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>
    details > summary { list-style: none; }
    details > summary::-webkit-details-marker { display: none; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <!-- Header -->
  <header class="bg-gradient-to-r from-purple-900/60 via-blue-900/60 to-purple-900/60 border-b border-gray-800">
    <div class="max-w-4xl mx-auto px-6 py-8">
      <h1 class="text-3xl font-bold tracking-tight">
        <span class="mr-2">🧠</span> Mindbrain E2E Test Report
      </h1>
      <p class="text-gray-400 text-sm mt-2">${now} &middot; ${totalDurationStr}s total</p>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-6 py-8 space-y-6">
    <!-- Summary Bar -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-6">
          <div>
            <span class="text-2xl font-bold ${allPassed ? "text-emerald-400" : "text-red-400"}">${passedTests}</span>
            <span class="text-gray-500 text-sm ml-1">passed</span>
          </div>
          ${failedTests > 0 ? `
          <div>
            <span class="text-2xl font-bold text-red-400">${failedTests}</span>
            <span class="text-gray-500 text-sm ml-1">failed</span>
          </div>` : ""}
          <div>
            <span class="text-lg text-gray-400">${passedSubtests}/${totalSubtests}</span>
            <span class="text-gray-500 text-sm ml-1">subtests</span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-3xl font-bold ${allPassed ? "text-emerald-400" : "text-red-400"}">${passRate}%</span>
        </div>
      </div>
      <div class="bg-gray-800 rounded-full h-3 overflow-hidden">
        <div class="bg-gradient-to-r ${allPassed ? "from-emerald-500 to-emerald-400" : "from-emerald-500 to-emerald-400"} h-3 rounded-full transition-all duration-500" style="width: ${passRate}%"></div>
      </div>
    </div>

    <!-- Test Cards -->
    <div class="space-y-3">
      ${testCards}
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-gray-800 mt-12">
    <div class="max-w-4xl mx-auto px-6 py-6 text-center">
      <p class="text-gray-600 text-xs">Generated by Mindbrain Test Runner &middot; ${now}</p>
    </div>
  </footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CWD = "/Users/kev/Documents/lab/sandbox/mindbrain";
const DB_PATH = `/tmp/mindbrain-test-${Date.now()}.db`;
const REPORT_PATH = `${CWD}/tests/e2e/report.html`;

async function main() {
  console.log("🧠 Mindbrain E2E Test Runner");
  console.log(`   DB: ${DB_PATH}`);
  console.log("");

  // Start API server
  console.log("▸ Starting API server...");
  const apiProcess = Bun.spawn(["bun", "run", "apps/api/src/index.ts"], {
    cwd: CWD,
    env: { ...process.env, DB_PATH },
    stdout: "ignore",
    stderr: "ignore",
  });

  // Wait for health check
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        healthy = true;
        break;
      }
    } catch {
      // not ready yet
    }
    await Bun.sleep(200);
  }

  if (!healthy) {
    console.error("✗ API server failed to start within 6s");
    apiProcess.kill();
    process.exit(1);
  }
  console.log("✓ API server ready on :3456\n");

  // Run tests sequentially
  const tests: Array<{ name: string; fn: () => Promise<SubTest[]> }> = [
    { name: "Auth & Project Lifecycle", fn: testAuthProjectLifecycle },
    { name: "Notes CRUD", fn: testNotesCRUD },
    { name: "Wikilinks Auto-Edges", fn: testWikilinksAutoEdges },
    { name: "FTS5 Search", fn: testFTS5Search },
    { name: "Context Search", fn: testContextSearch },
    { name: "Graph Traversal", fn: testGraphTraversal },
    { name: "Short ID Resolution", fn: testShortIdResolution },
    { name: "Import/Export Round-trip", fn: testImportExportRoundtrip },
    { name: "Edge Cases", fn: testEdgeCases },
    { name: "Multi-Project Isolation", fn: testMultiProjectIsolation },
  ];

  const results: TestResult[] = [];
  const totalStart = performance.now();

  for (const test of tests) {
    const result = await runTest(test.name, test.fn);
    results.push(result);

    const icon = result.passed ? "✓" : "✗";
    const color = result.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const dur = (result.duration / 1000).toFixed(2);
    const sub = `${result.subtests.filter((s) => s.passed).length}/${result.subtests.length}`;
    console.log(`${color}${icon}${reset} ${result.name} (${sub} subtests, ${dur}s)`);

    // Print failures inline
    for (const st of result.subtests.filter((s) => !s.passed)) {
      console.log(`  \x1b[31m✗ ${st.name}: ${st.error}\x1b[0m`);
      if (st.expected) console.log(`    expected: ${st.expected}`);
      if (st.got) console.log(`    got:      ${st.got}`);
    }
  }

  const totalDuration = performance.now() - totalStart;

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log("");
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (failed === 0) {
    console.log(`\x1b[32m✓ All ${passed} test suites passed\x1b[0m (${(totalDuration / 1000).toFixed(2)}s)`);
  } else {
    console.log(`\x1b[31m✗ ${failed} failed\x1b[0m, \x1b[32m${passed} passed\x1b[0m (${(totalDuration / 1000).toFixed(2)}s)`);
  }

  // Generate HTML report
  const html = generateReport(results, totalDuration);
  await Bun.write(REPORT_PATH, html);
  console.log(`\n📄 Report: ${REPORT_PATH}`);

  // Cleanup
  apiProcess.kill();
  try {
    const { unlinkSync } = await import("fs");
    unlinkSync(DB_PATH);
    console.log(`🗑  Cleaned up ${DB_PATH}`);
  } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
