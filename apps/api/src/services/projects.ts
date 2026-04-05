import { db } from "../db";
import { projects, notes, edges } from "../db/schema";
import { eq, count, sql } from "drizzle-orm";

export function generateApiKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `mb_${hex}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createProject(name: string, path?: string | null) {
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const id = crypto.randomUUID();
  const now = Date.now();

  const [project] = await db
    .insert(projects)
    .values({
      id,
      name,
      path: path ?? null,
      apiKeyHash,
      createdAt: now,
    })
    .returning();

  return { project, apiKey };
}

export async function getProjectByKeyHash(hash: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.apiKeyHash, hash))
    .limit(1);

  return project ?? null;
}

export async function getProjectStats(projectId: string) {
  const [[noteResult], [edgeResult]] = await Promise.all([
    db
      .select({ count: count() })
      .from(notes)
      .where(eq(notes.projectId, projectId)),
    db
      .select({ count: count() })
      .from(edges)
      .where(
        sql`${edges.sourceId} IN (SELECT id FROM notes WHERE project_id = ${projectId})`
      ),
  ]);

  // Count distinct tags across all notes in the project
  const tagRows = await db
    .select({ tags: notes.tags })
    .from(notes)
    .where(eq(notes.projectId, projectId));

  const tagSet = new Set<string>();
  for (const row of tagRows) {
    const parsed: string[] = JSON.parse(row.tags);
    for (const tag of parsed) {
      tagSet.add(tag);
    }
  }

  return {
    noteCount: noteResult.count,
    edgeCount: edgeResult.count,
    tagCount: tagSet.size,
  };
}
