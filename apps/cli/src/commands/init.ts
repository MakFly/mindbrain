import { Command } from "commander";
import { MindbrainClient } from "../client";
import { saveConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export const initCommand = new Command("init")
  .description("Initialize a new Mindbrain project")
  .argument("[name]", "Project name")
  .option("-p, --path <path>", "Project path", process.cwd())
  .action(async (name: string | undefined, opts: { path: string }) => {
    const projectName = name || opts.path.split("/").pop() || "unnamed";
    const apiUrl = process.env.MINDBRAIN_API_URL || "http://localhost:3456";

    try {
      const client = new MindbrainClient(apiUrl, "");
      const { project, apiKey } = await client.createProject(
        projectName,
        opts.path,
      );

      await saveConfig({
        apiUrl,
        apiKey,
        defaultProject: project.id,
      });

      console.log(
        `${BOLD}Project created:${RESET} ${project.name} ${DIM}(${project.id.slice(0, 8)})${RESET}`,
      );
      console.log(`${BOLD}API Key:${RESET} ${apiKey}`);
      console.log(`${DIM}Config saved to ~/.mindbrain/config.json${RESET}`);
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
