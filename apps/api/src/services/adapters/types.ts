import type { NoteType, SourceType } from "@mindbrain/shared";

export interface SourceEntry {
  sourceId: string;
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface SourceAdapter {
  name: SourceType;
  detect(path: string): Promise<boolean>;
  scan(path: string): Promise<SourceEntry[]>;
}
