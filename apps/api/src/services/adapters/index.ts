import type { SourceAdapter } from "./types";
import type { SourceType } from "@mindbrain/shared";
import { flatFilesAdapter } from "./flat-files";
import { claudeMemAdapter } from "./claude-mem";
import { mempalaceAdapter } from "./mempalace";
import { cursorRulesAdapter } from "./cursor-rules";

const adapters: Record<SourceType, SourceAdapter> = {
  "flat-files": flatFilesAdapter,
  "claude-mem": claudeMemAdapter,
  "mempalace": mempalaceAdapter,
  "cursor-rules": cursorRulesAdapter,
};

export function getAdapter(source: SourceType): SourceAdapter {
  return adapters[source];
}

export async function detectAll(
  basePaths?: string[]
): Promise<{ source: SourceType; path: string }[]> {
  const paths = basePaths ?? [
    `${process.env.HOME}/.claude`,
    `${process.env.HOME}/.claude-mem`,
    `${process.env.HOME}/.cursor`,
    `${process.env.HOME}/.mempalace`,
  ];
  const detected: { source: SourceType; path: string }[] = [];
  for (const [name, adapter] of Object.entries(adapters)) {
    for (const p of paths) {
      if (await adapter.detect(p)) {
        detected.push({ source: name as SourceType, path: p });
        break;
      }
    }
  }
  return detected;
}
