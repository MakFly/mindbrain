import { Command } from "commander";
import { homedir } from "os";
import { join, dirname, resolve } from "path";
import { mkdir, copyFile, chmod } from "fs/promises";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

const MARKER_BEGIN = "# ── BEGIN MINDBRAIN ──";
const MARKER_END = "# ── END MINDBRAIN ──";

/**
 * Walk up from import.meta.dir to find the monorepo root (package.json with name "mindbrain")
 */
function findMindbrainDir(): string {
  let dir = resolve(import.meta.dir);
  while (dir !== "/") {
    try {
      const pkg = require(join(dir, "package.json"));
      if (pkg.name === "mindbrain") return dir;
    } catch {}
    dir = dirname(dir);
  }
  throw new Error("Could not find mindbrain root directory");
}

/**
 * Inject a source block between markers into a hook file.
 * If the file doesn't exist, create it with a minimal shebang + block.
 * If markers already present, skip (idempotent).
 */
async function injectIntoHook(
  hookPath: string,
  sourceScript: string,
  insertBeforePattern: string | null,
  fallbackContent: string,
): Promise<boolean> {
  const file = Bun.file(hookPath);
  const sourceBlock = [
    MARKER_BEGIN,
    `[[ -f "$HOME/.mindbrain/hooks/${sourceScript}" ]] && source "$HOME/.mindbrain/hooks/${sourceScript}"`,
    MARKER_END,
  ].join("\n");

  if (await file.exists()) {
    const content = await file.text();

    // Already injected — idempotent
    if (content.includes(MARKER_BEGIN)) return false;

    // Find insertion point — try each pattern in order
    const patterns = insertBeforePattern
      ? [insertBeforePattern, "exit 0", "# ── 3"]
      : ["exit 0"];

    const lines = content.split("\n");
    for (const pattern of patterns) {
      const idx = lines.findIndex((l) => l.includes(pattern));
      if (idx !== -1) {
        lines.splice(idx, 0, sourceBlock, "");
        await Bun.write(hookPath, lines.join("\n"));
        return true;
      }
    }

    // Fallback: append at end
    await Bun.write(hookPath, content.trimEnd() + "\n\n" + sourceBlock + "\n");
    return true;
  }

  // File doesn't exist — create minimal hook
  await Bun.write(hookPath, fallbackContent.replace("{{SOURCE_BLOCK}}", sourceBlock));
  await chmod(hookPath, 0o755);
  return true;
}

/**
 * Remove Mindbrain block from a hook file (between markers, inclusive).
 */
function removeMindbrainBlock(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.includes(MARKER_BEGIN)) {
      inBlock = true;
      // Also remove blank line before if present
      if (result.length > 0 && result[result.length - 1].trim() === "") {
        result.pop();
      }
      continue;
    }
    if (line.includes(MARKER_END)) {
      inBlock = false;
      continue;
    }
    if (!inBlock) {
      result.push(line);
    }
  }

  return result.join("\n");
}

async function installClaudeCode(home: string, mindbrainDir: string) {
  const hooksSource = join(mindbrainDir, "integrations/claude-code/hooks");
  const hooksDest = join(home, ".mindbrain/hooks");
  const claudeHooksDir = join(home, ".claude/hooks");
  const settingsPath = join(home, ".claude/settings.json");

  // Copy hook scripts
  await mkdir(hooksDest, { recursive: true });
  const hookFiles = ["session-inject.sh", "precompact-inject.sh"];
  for (const hookFile of hookFiles) {
    const src = join(hooksSource, hookFile);
    const dst = join(hooksDest, hookFile);
    await copyFile(src, dst);
    await chmod(dst, 0o755);
  }
  console.log(`${GREEN}✓${RESET} Hook scripts installed at ${DIM}${hooksDest}/${RESET}`);

  // Inject into session-start.sh
  await mkdir(claudeHooksDir, { recursive: true });
  const sessionHook = join(claudeHooksDir, "session-start.sh");
  const sessionInjected = await injectIntoHook(
    sessionHook,
    "session-inject.sh",
    'if [[ -n "$MEMORY_OUTPUT" ]]; then',
    `#!/bin/bash\nset -u\n\nMEMORY_OUTPUT=""\n\n{{SOURCE_BLOCK}}\n\nif [[ -n "$MEMORY_OUTPUT" ]]; then\n  ESCAPED=$(printf '%s' "$MEMORY_OUTPUT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')\n  echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"SessionStart\\",\\"suppressOutput\\":true,\\"additionalContext\\":\${ESCAPED}}}"\nfi\n\nexit 0\n`,
  );
  console.log(sessionInjected
    ? `${GREEN}✓${RESET} Session-start hook integrated`
    : `${DIM}─${RESET} Session-start hook already integrated ${DIM}(skipped)${RESET}`);

  // Inject into pre-compact.sh
  const precompactHook = join(claudeHooksDir, "pre-compact.sh");
  const precompactInjected = await injectIntoHook(
    precompactHook,
    "precompact-inject.sh",
    "ESCAPED=",
    `#!/bin/bash\nset -u\n\nCOMPACT_CTX="CRITICAL CONTEXT TO PRESERVE:"\n\n{{SOURCE_BLOCK}}\n\nESCAPED=$(printf '%s' "$COMPACT_CTX" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')\necho "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreCompact\\",\\"additionalContext\\":\${ESCAPED}}}"\n`,
  );
  console.log(precompactInjected
    ? `${GREEN}✓${RESET} Pre-compact hook integrated`
    : `${DIM}─${RESET} Pre-compact hook already integrated ${DIM}(skipped)${RESET}`);

  // Add Bash permissions
  const permsToAdd = ["Bash(mb *)", "Bash(mb-daemon *)"];
  let permsAdded = false;
  try {
    const settingsFile = Bun.file(settingsPath);
    let settings: any = {};
    if (await settingsFile.exists()) {
      settings = JSON.parse(await settingsFile.text());
    }
    if (!settings.permissions) settings.permissions = {};
    if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
    for (const perm of permsToAdd) {
      if (!settings.permissions.allow.includes(perm)) {
        settings.permissions.allow.push(perm);
        permsAdded = true;
      }
    }
    if (permsAdded) {
      await Bun.write(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      console.log(`${GREEN}✓${RESET} Bash permissions added to settings.json`);
    } else {
      console.log(`${DIM}─${RESET} Bash permissions already present ${DIM}(skipped)${RESET}`);
    }
  } catch (err: any) {
    console.error(`${DIM}⚠ Could not update settings.json: ${err.message}${RESET}`);
  }
}

async function installCursor(home: string, mindbrainDir: string) {
  const cursorRulesDir = join(process.cwd(), ".cursor/rules");
  await mkdir(cursorRulesDir, { recursive: true });

  const templatePath = join(mindbrainDir, "integrations/cursor/mindbrain.mdc.template");
  const destPath = join(cursorRulesDir, "mindbrain.mdc");

  // Check if already installed
  const destFile = Bun.file(destPath);
  if (await destFile.exists()) {
    console.log(`${DIM}─${RESET} Cursor rules already installed ${DIM}(skipped)${RESET}`);
    return;
  }

  const template = await Bun.file(templatePath).text();
  await Bun.write(destPath, template);
  console.log(`${GREEN}✓${RESET} Cursor rules installed at ${DIM}${destPath}${RESET}`);
}

async function installCodex(mindbrainDir: string) {
  const agentsMdPath = join(process.cwd(), "AGENTS.md");
  const templatePath = join(mindbrainDir, "integrations/codex/agents-md.template");

  const template = await Bun.file(templatePath).text();
  const block = `\n\n${MARKER_BEGIN}\n${template}\n${MARKER_END}\n`;

  const agentsFile = Bun.file(agentsMdPath);
  if (await agentsFile.exists()) {
    const content = await agentsFile.text();
    if (content.includes(MARKER_BEGIN)) {
      console.log(`${DIM}─${RESET} AGENTS.md already has Mindbrain section ${DIM}(skipped)${RESET}`);
      return;
    }
    await Bun.write(agentsMdPath, content.trimEnd() + block);
  } else {
    await Bun.write(agentsMdPath, `# Agents${block}`);
  }
  console.log(`${GREEN}✓${RESET} Mindbrain section added to ${DIM}${agentsMdPath}${RESET}`);
}

async function installGemini(home: string) {
  const geminiDir = join(process.cwd(), ".gemini");
  await mkdir(geminiDir, { recursive: true });

  const destPath = join(geminiDir, "mindbrain-context.md");

  const destFile = Bun.file(destPath);
  if (await destFile.exists()) {
    console.log(`${DIM}─${RESET} Gemini context already installed ${DIM}(skipped)${RESET}`);
    return;
  }

  const content = `# Mindbrain Memory System

This project uses Mindbrain for persistent memory across sessions.

## Available Commands

- \`mb context -f <files> -t "<task>"\` — Get contextually relevant notes for your current task
- \`mb save "<title>" -t <type>\` — Save a note (types: user, feedback, project, reference, codebase, debug)
- \`mb search "<query>"\` — Search existing notes
- \`mb mine --dry-run\` — Extract notes from past conversations

## When to Use

- **Before starting a task**: Run \`mb context\` to recall relevant past knowledge
- **After a correction**: Save feedback with \`mb save "..." -t feedback\`
- **After resolving a bug**: Save the fix with \`mb save "..." -t debug\`
- **After a decision**: Save it with \`mb save "..." -t project\`

## Memory Types

| Type | When to use |
|------|------------|
| user | User preferences, role, knowledge |
| feedback | Corrections, behavioral rules |
| project | Decisions, goals, timelines |
| reference | External resources, links |
| codebase | Code patterns, architecture |
| debug | Bug fixes, root causes |
`;

  await Bun.write(destPath, content);
  console.log(`${GREEN}✓${RESET} Gemini context installed at ${DIM}${destPath}${RESET}`);
}

export const installCommand = new Command("install")
  .description("Install Mindbrain integration into Claude Code")
  .option("--platform <platform>", "Target platform (claude-code|cursor|codex|gemini|all)", "claude-code")
  .action(async (opts: { platform: string }) => {
    const home = homedir();
    const mindbrainDir = findMindbrainDir();
    const localBin = join(home, ".local/bin");

    console.log(`${BOLD}Mindbrain — Install${RESET}\n`);

    // ── 1. Always: Create CLI wrappers ──
    await mkdir(localBin, { recursive: true });

    const mbWrapper = join(localBin, "mb");
    const mbContent = `#!/bin/bash\nexec bun run ${mindbrainDir}/apps/cli/src/index.ts "$@"\n`;
    await Bun.write(mbWrapper, mbContent);
    await chmod(mbWrapper, 0o755);
    console.log(`${GREEN}✓${RESET} mb CLI installed at ${DIM}${mbWrapper}${RESET}`);

    const mbDaemonWrapper = join(localBin, "mb-daemon");
    const mbDaemonContent = `#!/bin/bash\nexec bash ${mindbrainDir}/scripts/daemon.sh "$@"\n`;
    await Bun.write(mbDaemonWrapper, mbDaemonContent);
    await chmod(mbDaemonWrapper, 0o755);
    console.log(`${GREEN}✓${RESET} mb-daemon installed at ${DIM}${mbDaemonWrapper}${RESET}`);

    // ── 2. Platform-specific installs ──
    const platforms = opts.platform === "all"
      ? ["claude-code", "cursor", "codex", "gemini"]
      : [opts.platform];

    for (const platform of platforms) {
      console.log(`\n${BOLD}── ${platform} ──${RESET}`);

      switch (platform) {
        case "claude-code":
          await installClaudeCode(home, mindbrainDir);
          break;
        case "cursor":
          await installCursor(home, mindbrainDir);
          break;
        case "codex":
          await installCodex(mindbrainDir);
          break;
        case "gemini":
          await installGemini(home);
          break;
        default:
          console.log(`${DIM}Unknown platform: ${platform}${RESET}`);
      }
    }

    // ── Summary ──
    console.log(`\n${BOLD}Next steps:${RESET}`);
    console.log(`  1. Start the daemon: ${DIM}mb-daemon start${RESET}`);
    console.log(`  2. Init your project: ${DIM}cd /your/project && mb init${RESET}`);
  });
