import { z } from "zod";

export const noteTypeSchema = z.enum([
  "user",
  "feedback",
  "project",
  "reference",
  "codebase",
  "debug",
]);

export const edgeTypeSchema = z.enum(["wikilink", "tag", "related", "blocks"]);

export const createNoteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().default(""),
  type: noteTypeSchema,
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  type: noteTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  path: z.string().nullable().default(null),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  tags: z.array(z.string()).optional(),
  type: noteTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const contextRequestSchema = z.object({
  files: z.array(z.string()).default([]),
  task: z.string().min(1),
  tags: z.array(z.string()).optional(),
  type: noteTypeSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const graphQuerySchema = z.object({
  noteId: z.string().optional(),
  depth: z.number().int().min(1).max(10).default(2),
});

export const createLinkSchema = z.object({
  targetId: z.string(),
  type: edgeTypeSchema.default("related"),
});

export const sourceTypeSchema = z.enum(["claude-mem", "mempalace", "flat-files", "cursor-rules"]);
export const platformTypeSchema = z.enum(["claude-code", "cursor", "codex", "gemini"]);

export const importSchema = z.object({
  source: sourceTypeSchema,
  path: z.string().min(1),
  dryRun: z.boolean().default(false),
});

export const mineSchema = z.object({
  platform: z.enum(["claude-code", "cursor", "codex", "auto"]).default("auto"),
  since: z.string().optional(),
  dryRun: z.boolean().default(false),
  llm: z.boolean().default(false),
});

export const sourceQuerySchema = z.object({
  source: sourceTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
