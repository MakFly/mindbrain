import { Command } from "commander";
import { homedir } from "os";
import { join, dirname, resolve } from "path";
import { mkdir, copyFile, chmod, readFile } from "fs/promises";

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

export const installCommand = new Command("install")
  .description("Install Mindbrain integration into Claude Code")
  .action(async () => {
    const home = homedir();
    const mindbrainDir = findMindbrainDir();
    const hooksSource = join(mindbrainDir, "integrations/claude-code/hooks");
    const hooksDest = join(home, ".mindbrain/hooks");
    const localBin = join(home, ".local/bin");
    const claudeHooksDir = join(home, ".claude/hooks");
    const settingsPath = join(home, ".claude/settings.json");

    console.log(`${BOLD}Mindbrain — Install${RESET}\n`);

    // ── 1. Create ~/.local/bin/mb wrapper ──
    await mkdir(localBin, { recursive: true });

    const mbWrapper = join(localBin, "mb");
    const mbContent = `#!/bin/bash\nexec bun run ${mindbrainDir}/apps/cli/src/index.ts "$@"\n`;

    await Bun.write(mbWrapper, mbContent);
    await chmod(mbWrapper, 0o755);
    console.log(`${GREEN}✓${RESET} mb CLI installed at ${DIM}${mbWrapper}${RESET}`);

    // ── 1b. Create ~/.local/bin/mb-daemon wrapper ──
    const mbDaemonWrapper = join(localBin, "mb-daemon");
    const mbDaemonContent = `#!/bin/bash\nexec bash ${mindbrainDir}/scripts/daemon.sh "$@"\n`;

    await Bun.write(mbDaemonWrapper, mbDaemonContent);
    await chmod(mbDaemonWrapper, 0o755);
    console.log(`${GREEN}✓${RESET} mb-daemon installed at ${DIM}${mbDaemonWrapper}${RESET}`);

    // ── 2. Copy hook scripts to ~/.mindbrain/hooks/ ──
    await mkdir(hooksDest, { recursive: true });

    const hookFiles = ["session-inject.sh", "precompact-inject.sh"];
    for (const hookFile of hookFiles) {
      const src = join(hooksSource, hookFile);
      const dst = join(hooksDest, hookFile);
      await copyFile(src, dst);
      await chmod(dst, 0o755);
    }
    console.log(`${GREEN}✓${RESET} Hook scripts installed at ${DIM}${hooksDest}/${RESET}`);

    // ── 3. Inject into session-start.sh ──
    await mkdir(claudeHooksDir, { recursive: true });

    const sessionHook = join(claudeHooksDir, "session-start.sh");
    const sessionInjected = await injectIntoHook(
      sessionHook,
      "session-inject.sh",
      'if [[ -n "$MEMORY_OUTPUT" ]]; then',
      `#!/bin/bash\nset -u\n\nMEMORY_OUTPUT=""\n\n{{SOURCE_BLOCK}}\n\nif [[ -n "$MEMORY_OUTPUT" ]]; then\n  ESCAPED=$(printf '%s' "$MEMORY_OUTPUT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')\n  echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"SessionStart\\",\\"suppressOutput\\":true,\\"additionalContext\\":\${ESCAPED}}}"\nfi\n\nexit 0\n`,
    );
    if (sessionInjected) {
      console.log(`${GREEN}✓${RESET} Session-start hook integrated`);
    } else {
      console.log(`${DIM}─${RESET} Session-start hook already integrated ${DIM}(skipped)${RESET}`);
    }

    // ── 4. Inject into pre-compact.sh ──
    const precompactHook = join(claudeHooksDir, "pre-compact.sh");
    const precompactInjected = await injectIntoHook(
      precompactHook,
      "precompact-inject.sh",
      "ESCAPED=",
      `#!/bin/bash\nset -u\n\nCOMPACT_CTX="CRITICAL CONTEXT TO PRESERVE:"\n\n{{SOURCE_BLOCK}}\n\nESCAPED=$(printf '%s' "$COMPACT_CTX" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')\necho "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreCompact\\",\\"additionalContext\\":\${ESCAPED}}}"\n`,
    );
    if (precompactInjected) {
      console.log(`${GREEN}✓${RESET} Pre-compact hook integrated`);
    } else {
      console.log(`${DIM}─${RESET} Pre-compact hook already integrated ${DIM}(skipped)${RESET}`);
    }

    // ── 5. Add Bash(mb *) to settings.json permissions ──
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

    // ── 6. Summary ──
    const snippetPath = join(mindbrainDir, "integrations/claude-code/CLAUDE.md.snippet");
    console.log(`\n${BOLD}Next steps:${RESET}`);
    console.log(`  1. Start the daemon: ${DIM}mb-daemon start${RESET}`);
    console.log(`  2. Init your project: ${DIM}cd /your/project && mb init${RESET}`);
    console.log(`  3. Add memory instructions: ${DIM}cat ${snippetPath} >> CLAUDE.md${RESET}`);
  });
