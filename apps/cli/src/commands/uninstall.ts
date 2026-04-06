import { Command } from "commander";
import { homedir } from "os";
import { join } from "path";
import { unlink, rm, readFile } from "fs/promises";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const MARKER_BEGIN = "# ── BEGIN MINDBRAIN ──";
const MARKER_END = "# ── END MINDBRAIN ──";

/**
 * Remove everything between BEGIN/END markers (inclusive) from file content.
 */
function removeMindbrainBlock(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.includes(MARKER_BEGIN)) {
      inBlock = true;
      // Remove trailing blank line before block
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

export const uninstallCommand = new Command("uninstall")
  .description("Remove Mindbrain integration from Claude Code")
  .option("-y, --yes", "Remove ~/.mindbrain/ data without prompting")
  .action(async (opts: { yes?: boolean }) => {
    const home = homedir();
    const claudeHooksDir = join(home, ".claude/hooks");
    const settingsPath = join(home, ".claude/settings.json");
    const localBin = join(home, ".local/bin");

    console.log(`${BOLD}Mindbrain — Uninstall${RESET}\n`);

    // ── 1. Remove Mindbrain blocks from hooks ──
    const hookFiles = [
      { path: join(claudeHooksDir, "session-start.sh"), label: "session-start" },
      { path: join(claudeHooksDir, "pre-compact.sh"), label: "pre-compact" },
    ];

    for (const { path, label } of hookFiles) {
      try {
        const file = Bun.file(path);
        if (await file.exists()) {
          const content = await file.text();
          if (content.includes(MARKER_BEGIN)) {
            const cleaned = removeMindbrainBlock(content);
            await Bun.write(path, cleaned);
            console.log(`${GREEN}✓${RESET} Removed Mindbrain block from ${label}.sh`);
          } else {
            console.log(`${DIM}─${RESET} No Mindbrain block in ${label}.sh ${DIM}(skipped)${RESET}`);
          }
        } else {
          console.log(`${DIM}─${RESET} ${label}.sh not found ${DIM}(skipped)${RESET}`);
        }
      } catch (err: any) {
        console.error(`${DIM}⚠ Could not clean ${label}.sh: ${err.message}${RESET}`);
      }
    }

    // ── 2. Remove Bash(mb *) from settings.json ──
    try {
      const settingsFile = Bun.file(settingsPath);
      if (await settingsFile.exists()) {
        const settings = JSON.parse(await settingsFile.text());
        const permsToRemove = ["Bash(mb *)", "Bash(mb-daemon *)"];

        if (settings.permissions?.allow && Array.isArray(settings.permissions.allow)) {
          const before = settings.permissions.allow.length;
          settings.permissions.allow = settings.permissions.allow.filter(
            (p: string) => !permsToRemove.includes(p),
          );
          if (settings.permissions.allow.length < before) {
            await Bun.write(settingsPath, JSON.stringify(settings, null, 2) + "\n");
            console.log(`${GREEN}✓${RESET} Removed Bash permissions from settings.json`);
          } else {
            console.log(`${DIM}─${RESET} No Mindbrain permissions in settings.json ${DIM}(skipped)${RESET}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`${DIM}⚠ Could not update settings.json: ${err.message}${RESET}`);
    }

    // ── 3. Remove ~/.local/bin/mb and mb-daemon ──
    for (const bin of ["mb", "mb-daemon"]) {
      const binPath = join(localBin, bin);
      try {
        const file = Bun.file(binPath);
        if (await file.exists()) {
          await unlink(binPath);
          console.log(`${GREEN}✓${RESET} Removed ${binPath}`);
        } else {
          console.log(`${DIM}─${RESET} ${binPath} not found ${DIM}(skipped)${RESET}`);
        }
      } catch (err: any) {
        console.error(`${DIM}⚠ Could not remove ${binPath}: ${err.message}${RESET}`);
      }
    }

    // ── 4. Stop daemon if running ──
    try {
      const pidFile = join(home, ".mindbrain/daemon.pid");
      const pidBunFile = Bun.file(pidFile);
      if (await pidBunFile.exists()) {
        const pid = (await pidBunFile.text()).trim();
        const proc = Bun.spawn(["kill", pid], { stdout: "ignore", stderr: "ignore" });
        await proc.exited;
        await unlink(pidFile).catch(() => {});
        console.log(`${GREEN}✓${RESET} Stopped daemon (PID ${pid})`);
      } else {
        console.log(`${DIM}─${RESET} Daemon not running ${DIM}(skipped)${RESET}`);
      }
    } catch {
      console.log(`${DIM}─${RESET} Daemon not running ${DIM}(skipped)${RESET}`);
    }

    // ── 5. Ask about data ──
    const mindbrainData = join(home, ".mindbrain");
    const dataExists = await Bun.file(join(mindbrainData, "config.json")).exists().catch(() => false);

    if (dataExists) {
      let removeData = opts.yes ?? false;

      if (!removeData) {
        process.stdout.write(`\nRemove ${DIM}~/.mindbrain/${RESET} data? (y/N) `);
        const response = await new Promise<string>((resolve) => {
          process.stdin.setEncoding("utf8");
          process.stdin.once("data", (data) => resolve(data.toString().trim()));
          // Timeout after 10s — default to no
          setTimeout(() => resolve("n"), 10000);
        });
        removeData = response.toLowerCase() === "y";
      }

      if (removeData) {
        await rm(mindbrainData, { recursive: true, force: true });
        console.log(`${GREEN}✓${RESET} Removed ~/.mindbrain/`);
      } else {
        console.log(`${DIM}─${RESET} Kept ~/.mindbrain/ data`);
      }
    }

    // ── 6. Summary ──
    console.log(`\n${GREEN}${BOLD}Uninstalled.${RESET} Mindbrain hooks removed from Claude Code.`);
    console.log(`${DIM}The mindbrain source code is untouched — only the integration was removed.${RESET}`);
  });
