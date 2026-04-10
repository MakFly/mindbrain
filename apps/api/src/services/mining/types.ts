import type { NoteType, PlatformType } from "@mindbrain/shared";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: number;
}

export interface Conversation {
  id: string;
  messages: Message[];
  platform: PlatformType;
  startedAt: number;
  path?: string; // file path of the conversation log
}

export interface ExtractedCandidate {
  title: string;
  content: string;
  type: NoteType;
  confidence: number; // 0.0 - 1.0
  sourceConversationId: string;
  sourceContext: string; // surrounding lines for review
}

export interface PlatformParser {
  platform: PlatformType;
  detect(): Promise<boolean>;
  parse(opts?: { since?: Date }): Promise<Conversation[]>;
}

export interface Extractor {
  extract(conversations: Conversation[]): ExtractedCandidate[];
}
