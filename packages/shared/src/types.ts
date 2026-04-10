export type NoteType = "user" | "feedback" | "project" | "reference" | "codebase" | "debug";
export type EdgeType = "wikilink" | "tag" | "related" | "blocks";

export interface Note {
  id: string;
  projectId: string;
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string | null;
  type: EdgeType;
  label: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  path: string | null;
  apiKeyHash: string;
  createdAt: number;
}

export interface ContextRequest {
  files: string[];
  task: string;
  tags?: string[];
  type?: NoteType;
  limit?: number;
}

export interface SearchQuery {
  q: string;
  tags?: string[];
  type?: NoteType;
  project?: string;
  limit?: number;
  offset?: number;
}

export interface GraphQuery {
  noteId?: string;
  project?: string;
  depth?: number;
}

export interface GraphResult {
  nodes: Note[];
  edges: Edge[];
}

export type SourceType = "claude-mem" | "mempalace" | "flat-files" | "cursor-rules";
export type PlatformType = "claude-code" | "cursor" | "codex" | "gemini";
export type SyncDirection = "import" | "export" | "bidirectional";

export interface SourceMetadata {
  id: string;
  noteId: string;
  source: SourceType;
  sourceId: string;
  importedAt: number;
  contentHash: string;
  syncDirection: SyncDirection;
}

export interface MiningConfig {
  platform: PlatformType | "auto";
  since?: string;
  dryRun?: boolean;
  llm?: boolean;
}

export interface MiningCandidate {
  title: string;
  content: string;
  type: NoteType;
  confidence: number;
  sourceContext: string;
  platform: PlatformType;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details?: string[];
}

export interface AdapterScanResult {
  source: SourceType;
  available: boolean;
  entryCount: number;
  path?: string;
}
