import { Command } from "commander";
import { resolve, join } from "path";
import { stat } from "fs/promises";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function findWebDir(): string {
  // Walk up from this file to find the monorepo root, then apps/web
  let dir = resolve(import.meta.dir);
  while (dir !== "/") {
    try {
      const pkg = require(join(dir, "package.json"));
      if (pkg.name === "mindbrain") return join(dir, "apps/web");
    } catch {}
    dir = resolve(dir, "..");
  }
  throw new Error("Could not find mindbrain root directory");
}

export const dashboardCommand = new Command("dashboard")
  .description("Launch the Mindbrain dashboard")
  .option("-p, --port <port>", "Port for the dev server", "5173")
  .action(async (opts: { port: string }) => {
    try {
      const webDir = findWebDir();

      // Check if apps/web exists
      try {
        await stat(webDir);
      } catch {
        console.log(`${DIM}Dashboard not found at ${webDir}${RESET}`);
        console.log(`${DIM}Run the setup first: cd apps/web && bun install${RESET}`);
        process.exit(1);
      }

      // Check if built
      const distDir = join(webDir, "dist");
      let hasDistDir = false;
      try {
        await stat(distDir);
        hasDistDir = true;
      } catch {}

      if (hasDistDir) {
        // Serve the built dashboard
        console.log(`${BOLD}Mindbrain Dashboard${RESET}`);
        console.log(`${GREEN}✓${RESET} Serving from ${DIM}${distDir}${RESET}`);
        console.log(`${DIM}Open http://localhost:${opts.port}${RESET}\n`);

        const proc = Bun.spawn(["bun", "run", "--cwd", webDir, "preview", "--port", opts.port], {
          stdout: "inherit",
          stderr: "inherit",
        });
        await proc.exited;
      } else {
        // Run dev server
        console.log(`${BOLD}Mindbrain Dashboard${RESET} ${DIM}(dev mode)${RESET}`);
        console.log(`${DIM}Starting at http://localhost:${opts.port}${RESET}\n`);

        const proc = Bun.spawn(["bun", "run", "--cwd", webDir, "dev", "--port", opts.port], {
          stdout: "inherit",
          stderr: "inherit",
        });
        await proc.exited;
      }
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
