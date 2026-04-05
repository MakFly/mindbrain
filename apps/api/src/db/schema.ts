import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path"),
  apiKeyHash: text("api_key_hash").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    type: text("type").notNull(),
    tags: text("tags").notNull().default("[]"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_notes_project").on(table.projectId),
    index("idx_notes_type").on(table.type),
    index("idx_notes_title").on(table.projectId, table.title),
  ]
);

export const edges = sqliteTable(
  "edges",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetId: text("target_id").references(() => notes.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    label: text("label").notNull().default(""),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_edges_source").on(table.sourceId),
    index("idx_edges_target").on(table.targetId),
  ]
);
