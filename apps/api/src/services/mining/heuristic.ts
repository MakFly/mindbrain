import type { Extractor, ExtractedCandidate, Conversation } from "./types";
import type { NoteType } from "@mindbrain/shared";

interface Pattern {
  name: string;
  regex: RegExp;
  type: NoteType;
  confidence: number;
}

const PATTERNS: Pattern[] = [
  {
    name: "correction",
    regex: /\b(non[,.]?\s|pas comme [çc]a|stop\b|arr[eê]te|wrong|don'?t do|shouldn'?t|never do that|c'est pas [çc]a)/i,
    type: "feedback",
    confidence: 0.8,
  },
  {
    name: "bugResolved",
    regex: /\b(fix(ed)?|résolu|resolved|the issue was|root cause|the bug was|the problem was|found it|that fixed it)/i,
    type: "debug",
    confidence: 0.7,
  },
  {
    name: "decision",
    regex: /\b(on va |let'?s go with|décid[ée]|we decided|chosen approach|going with|I('ll| will) use|utilisons|on choisit)/i,
    type: "project",
    confidence: 0.7,
  },
  {
    name: "preference",
    regex: /\b(je préf[èe]re|always use|never use|toujours utiliser|jamais utiliser|I prefer|I always|I never|I like to)/i,
    type: "user",
    confidence: 0.75,
  },
  {
    name: "learned",
    regex: /\b(TIL|aujourd'hui j'ai|I learned|turns out|en fait|it turns out|I didn'?t know|je savais pas|actually,? it)/i,
    type: "codebase",
    confidence: 0.65,
  },
];

// Number of context lines to extract around the match
const CONTEXT_LINES = 5;

export const heuristicExtractor: Extractor = {
  extract(conversations: Conversation[]): ExtractedCandidate[] {
    const candidates: ExtractedCandidate[] = [];

    for (const conv of conversations) {
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        if (msg.role === "tool" || msg.role === "system") continue;

        const lines = msg.content.split("\n");

        for (const pattern of PATTERNS) {
          // For corrections/preferences, only look at user messages
          if ((pattern.name === "correction" || pattern.name === "preference") && msg.role !== "user") continue;
          // For bugResolved/learned, look at assistant messages primarily
          if ((pattern.name === "bugResolved" || pattern.name === "learned") && msg.role !== "assistant") continue;

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (!pattern.regex.test(line)) continue;

            // Extract context: surrounding lines from this message + adjacent message
            const contextStart = Math.max(0, lineIdx - CONTEXT_LINES);
            const contextEnd = Math.min(lines.length, lineIdx + CONTEXT_LINES + 1);
            const contextLines = lines.slice(contextStart, contextEnd);

            // Also grab the adjacent message for context
            const adjacentMsg =
              msg.role === "user"
                ? conv.messages[i + 1] // assistant response after user correction
                : conv.messages[i - 1]; // user message before assistant discovery

            let fullContext = contextLines.join("\n");
            if (adjacentMsg && adjacentMsg.content.length < 2000) {
              fullContext += "\n---\n" + adjacentMsg.content.slice(0, 500);
            }

            const title = generateTitle(pattern.name, line);

            candidates.push({
              title,
              content: fullContext.trim(),
              type: pattern.type,
              confidence: pattern.confidence,
              sourceConversationId: conv.id,
              sourceContext: `${conv.platform}:${conv.path || conv.id}:L${lineIdx}`,
            });

            // Only extract first match per pattern per message
            break;
          }
        }
      }
    }

    // Deduplicate by title + type
    const seen = new Set<string>();
    return candidates.filter((c) => {
      const key = `${c.type}:${c.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};

function generateTitle(patternName: string, matchingLine: string): string {
  const cleaned = matchingLine.trim().slice(0, 100);

  const prefixes: Record<string, string> = {
    correction: "Correction",
    bugResolved: "Bug fix",
    decision: "Decision",
    preference: "Preference",
    learned: "Learned",
  };

  const prefix = prefixes[patternName] || "Note";

  if (cleaned.length <= 80) {
    return `${prefix}: ${cleaned}`;
  }

  const truncated = cleaned.slice(0, 77).replace(/\s+\S*$/, "");
  return `${prefix}: ${truncated}...`;
}
