import { Command } from "commander";
import { homedir } from "os";
import { join } from "path";
import { unlink, rm } from "fs/promises";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const MARKER_BEGIN = "# ── BEGIN MINDBRAIN ──";
const MARKER_END = "# ── END MINDBRAIN ──";

function removeMindbrainBlock(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.includes(MARKER_BEGIN)) {
      inBlock = true;
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

async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} (y/N) `);
  return new Promise<boolean>((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim().toLowerCase() === "y");
    });
    setTimeout(() => resolve(false), 15000);
  });
}

/**
 * Find all .mindbrain.json files in common project directories
 */
async function findProjectConfigs(): Promise<string[]> {
  const home = homedir();
  const searchDirs = [
    join(home, "Documents"),
    join(home, "projects"),
    join(home, "Projects"),
    join(home, "dev"),
    join(home, "Dev"),
    join(home, "code"),
    join(home, "Code"),
    join(home, "src"),
    join(home, "workspace"),
    "/tmp",
  ];

  const found: string[] = [];

  for (const dir of searchDirs) {
    try {
      const proc = Bun.spawn(
        ["find", dir, "-maxdepth", "5", "-name", ".mindbrain.json", "-type", "f"],
        { stdout: "pipe", stderr: "ignore" },
      );
      const output = await new Response(proc.stdout).text();
      await proc.exited;
      const files = output.trim().split("\n").filter(Boolean);
      found.push(...files);
    } catch {}
  }

  return [...new Set(found)];
}

export const uninstallCommand = new Command("uninstall")
  .description("Remove Mindbrain integration from Claude Code")
  .option("-y, --yes", "Skip all confirmations")
  .option("--purge", "Also remove all .mindbrain.json files from projects and API data")
  .option("--platform <platform>", "Target platform to uninstall (claude-code|cursor|codex|gemini|all)")
  .action(async (opts: { yes?: boolean; purge?: boolean; platform?: string }) => {
    const home = homedir();
    const claudeHooksDir = join(home, ".claude/hooks");
    const settingsPath = join(home, ".claude/settings.json");
    const localBin = join(home, ".local/bin");

    console.log(`${BOLD}Mindbrain — Uninstall${RESET}\n`);

    // ── Platform-specific uninstall (non claude-code) ──
    if (opts.platform && opts.platform !== "claude-code") {
      const platforms = opts.platform === "all"
        ? ["cursor", "codex", "gemini"]
        : [opts.platform];

      for (const platform of platforms) {
        switch (platform) {
          case "cursor": {
            const rulesPath = join(process.cwd(), ".cursor/rules/mindbrain.mdc");
            try {
              const f = Bun.file(rulesPath);
              if (await f.exists()) {
                await unlink(rulesPath);
                console.log(`${GREEN}✓${RESET} Removed Cursor rules`);
              } else {
                console.log(`${DIM}─${RESET} Cursor rules not found ${DIM}(skipped)${RESET}`);
              }
            } catch {}
            break;
          }
          case "codex": {
            const agentsPath = join(process.cwd(), "AGENTS.md");
            try {
              const f = Bun.file(agentsPath);
              if (await f.exists()) {
                const content = await f.text();
                if (content.includes(MARKER_BEGIN)) {
                  const cleaned = removeMindbrainBlock(content);
                  await Bun.write(agentsPath, cleaned);
                  console.log(`${GREEN}✓${RESET} Removed Mindbrain section from AGENTS.md`);
                } else {
                  console.log(`${DIM}─${RESET} No Mindbrain section in AGENTS.md ${DIM}(skipped)${RESET}`);
                }
              }
            } catch {}
            break;
          }
          case "gemini": {
            const geminiPath = join(process.cwd(), ".gemini/mindbrain-context.md");
            try {
              const f = Bun.file(geminiPath);
              if (await f.exists()) {
                await unlink(geminiPath);
                console.log(`${GREEN}✓${RESET} Removed Gemini context`);
              } else {
                console.log(`${DIM}─${RESET} Gemini context not found ${DIM}(skipped)${RESET}`);
              }
            } catch {}
            break;
          }
        }
      }

      if (opts.platform !== "all") {
        console.log(`\n${GREEN}${BOLD}Uninstalled from ${opts.platform}.${RESET}`);
        return;
      }
    }

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
        }
      } catch (err: any) {
        console.error(`${DIM}⚠ Could not clean ${label}.sh: ${err.message}${RESET}`);
      }
    }

    // ── 2. Remove Bash permissions from settings.json ──
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
            console.log(`${DIM}─${RESET} No Mindbrain permissions found ${DIM}(skipped)${RESET}`);
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
        }
      } catch (err: any) {
        console.error(`${DIM}⚠ Could not remove ${binPath}: ${err.message}${RESET}`);
      }
    }

    // ── 4. Stop daemon ──
    try {
      const pidFile = join(home, ".mindbrain/daemon.pid");
      const pidBunFile = Bun.file(pidFile);
      if (await pidBunFile.exists()) {
        const pid = (await pidBunFile.text()).trim();
        const proc = Bun.spawn(["kill", pid], { stdout: "ignore", stderr: "ignore" });
        await proc.exited;
        await unlink(pidFile).catch(() => {});
        console.log(`${GREEN}✓${RESET} Stopped daemon (PID ${pid})`);
      }
    } catch {}

    // ── 5. Remove ~/.mindbrain/ (hooks, config, logs) ──
    const mindbrainDir = join(home, ".mindbrain");
    const dirExists = await Bun.file(join(mindbrainDir, "hooks/session-inject.sh")).exists().catch(() => false) ||
                      await Bun.file(join(mindbrainDir, "config.json")).exists().catch(() => false);

    if (dirExists) {
      const shouldRemove = opts.yes || await confirm(`\nRemove ${DIM}~/.mindbrain/${RESET} (hooks, config, logs)?`);
      if (shouldRemove) {
        await rm(mindbrainDir, { recursive: true, force: true });
        console.log(`${GREEN}✓${RESET} Removed ~/.mindbrain/`);
      } else {
        console.log(`${DIM}─${RESET} Kept ~/.mindbrain/`);
      }
    }

    // ── 6. Purge: find and remove all .mindbrain.json + API data ──
    if (opts.purge) {
      console.log(`\n${YELLOW}${BOLD}── Purge Mode ──${RESET}\n`);

      // Find all .mindbrain.json
      console.log(`${DIM}Searching for .mindbrain.json files...${RESET}`);
      const configs = await findProjectConfigs();

      if (configs.length > 0) {
        console.log(`\nFound ${BOLD}${configs.length}${RESET} project config(s):`);
        for (const f of configs) {
          console.log(`  ${DIM}${f}${RESET}`);
        }

        const shouldPurge = opts.yes || await confirm(`\n${RED}Delete all ${configs.length} .mindbrain.json files?${RESET}`);
        if (shouldPurge) {
          for (const f of configs) {
            try {
              await unlink(f);
              console.log(`${GREEN}✓${RESET} Removed ${DIM}${f}${RESET}`);
            } catch (err: any) {
              console.error(`${DIM}⚠ Could not remove ${f}: ${err.message}${RESET}`);
            }
          }
        } else {
          console.log(`${DIM}─${RESET} Kept .mindbrain.json files`);
        }
      } else {
        console.log(`${DIM}─${RESET} No .mindbrain.json files found`);
      }

      // Remove API database
      // Try to find it relative to the mindbrain source
      const possibleDbPaths = [
        join(home, "Documents/lab/sandbox/mindbrain/apps/api/data"),
        join(process.cwd(), "apps/api/data"),
      ];

      for (const dbDir of possibleDbPaths) {
        try {
          const dbFile = Bun.file(join(dbDir, "mindbrain.db"));
          if (await dbFile.exists()) {
            const shouldDeleteDb = opts.yes || await confirm(`\n${RED}Delete API database at ${dbDir}/?${RESET}`);
            if (shouldDeleteDb) {
              await rm(dbDir, { recursive: true, force: true });
              console.log(`${GREEN}✓${RESET} Removed API database`);
            } else {
              console.log(`${DIM}─${RESET} Kept API database`);
            }
            break;
          }
        } catch {}
      }
    }

    // ── Summary ──
    console.log(`\n${GREEN}${BOLD}Uninstalled.${RESET}`);
    console.log(`${DIM}Hooks, permissions, and CLI wrappers removed from Claude Code.${RESET}`);
    if (!opts.purge) {
      console.log(`${DIM}Run with --purge to also remove .mindbrain.json files and API data.${RESET}`);
    }
  });
