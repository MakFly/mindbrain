import { Command } from "commander";
import { MindbrainClient } from "../client";
import { saveGlobalConfig, saveProjectConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const initCommand = new Command("init")
  .description("Initialize a new Mindbrain project")
  .argument("[name]", "Project name")
  .option("-p, --path <path>", "Project root path", process.cwd())
  .option("--api-url <url>", "API URL", "http://localhost:3456")
  .action(async (name: string | undefined, opts: { path: string; apiUrl: string }) => {
    const projectName = name || opts.path.split("/").pop() || "unnamed";
    const apiUrl = process.env.MINDBRAIN_API_URL || opts.apiUrl;

    try {
      const client = new MindbrainClient(apiUrl, "");
      const { project, apiKey } = await client.createProject(
        projectName,
        opts.path,
      );

      // Save global config (apiUrl)
      await saveGlobalConfig({ apiUrl });

      // Save project config (.mindbrain.json in project root)
      await saveProjectConfig(opts.path, {
        projectId: project.id,
        apiKey,
      });

      console.log(
        `${BOLD}Project created:${RESET} ${project.name} ${DIM}(${project.id.slice(0, 8)})${RESET}`,
      );
      console.log(`${BOLD}API Key:${RESET} ${apiKey}`);
      console.log(`${DIM}Config saved to ${opts.path}/.mindbrain.json${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
