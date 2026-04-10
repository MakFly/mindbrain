import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const API_ROOT = resolve(import.meta.dir, "../..");
const DB_PATH = process.env.DB_PATH || resolve(API_ROOT, "data/mindbrain.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist (for dev — production uses drizzle-kit push)
export function ensureTables() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT,
      api_key_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(project_id, title)`);
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)`);
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sources_metadata (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      imported_at INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      sync_direction TEXT NOT NULL DEFAULT 'import'
    )
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_sources_note ON sources_metadata(note_id)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_sources_source ON sources_metadata(source)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_sources_hash ON sources_metadata(content_hash)`);
}

// Setup FTS5 virtual table and triggers
export function setupFTS() {
  sqlite.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content,
      tags,
      content='notes',
      content_rowid='rowid'
    )
  `);

  // Triggers to keep FTS in sync with notes table
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content, tags)
      VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
    END
  `);

  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
    END
  `);

  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
      INSERT INTO notes_fts(rowid, title, content, tags)
      VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
    END
  `);
}

// Raw sqlite instance for FTS5 queries (Drizzle doesn't support FTS5)
export { sqlite };
