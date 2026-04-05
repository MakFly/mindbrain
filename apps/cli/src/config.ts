import { join } from "path";
import { homedir } from "os";

export interface Config {
  apiUrl: string;
  apiKey: string;
  defaultProject: string;
}

const CONFIG_DIR = join(homedir(), ".mindbrain");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<Config | null> {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (!(await file.exists())) return null;
    return (await file.json()) as Config;
  } catch {
    return null;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const { mkdir } = await import("fs/promises");
  await mkdir(CONFIG_DIR, { recursive: true });
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
