import { join, resolve, dirname } from "path";
import { homedir } from "os";

/** Global config — API URL only */
export interface GlobalConfig {
  apiUrl: string;
}

/** Per-project config — lives in .mindbrain.json at project root */
export interface ProjectConfig {
  projectId: string;
  apiKey: string;
}

/** Resolved config — merged global + project */
export interface Config {
  apiUrl: string;
  apiKey: string;
  defaultProject: string;
}

const GLOBAL_DIR = join(homedir(), ".mindbrain");
const GLOBAL_PATH = join(GLOBAL_DIR, "config.json");
const PROJECT_FILE = ".mindbrain.json";

/**
 * Walk up from cwd to find .mindbrain.json (like git finds .git/)
 */
export function findProjectConfig(from: string = process.cwd()): { path: string; config: ProjectConfig } | null {
  let dir = resolve(from);
  const root = dirname(dir) === dir ? dir : "/";

  while (true) {
    const candidate = join(dir, PROJECT_FILE);
    try {
      const content = require(candidate);
      return { path: candidate, config: content as ProjectConfig };
    } catch {
      // not found, go up
    }

    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}

/**
 * Load global config (~/.mindbrain/config.json)
 */
export async function loadGlobalConfig(): Promise<GlobalConfig | null> {
  try {
    const file = Bun.file(GLOBAL_PATH);
    if (!(await file.exists())) return null;
    return (await file.json()) as GlobalConfig;
  } catch {
    return null;
  }
}

/**
 * Resolve config: project .mindbrain.json + global config
 * Priority: project file > global config > env vars
 */
export async function loadConfig(): Promise<Config | null> {
  const apiUrl = process.env.MINDBRAIN_API_URL || "http://localhost:3456";

  // 1. Try project-level config (.mindbrain.json walking up)
  const project = findProjectConfig();
  if (project) {
    // Load global for apiUrl override
    const global = await loadGlobalConfig();
    return {
      apiUrl: global?.apiUrl || apiUrl,
      apiKey: project.config.apiKey,
      defaultProject: project.config.projectId,
    };
  }

  // 2. Fallback: legacy global config (backwards compat)
  try {
    const file = Bun.file(GLOBAL_PATH);
    if (!(await file.exists())) return null;
    const legacy = (await file.json()) as any;
    if (legacy.apiKey) {
      return {
        apiUrl: legacy.apiUrl || apiUrl,
        apiKey: legacy.apiKey,
        defaultProject: legacy.defaultProject || "",
      };
    }
  } catch {}

  return null;
}

/**
 * Save global config (~/.mindbrain/config.json) — apiUrl only
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  const { mkdir } = await import("fs/promises");
  await mkdir(GLOBAL_DIR, { recursive: true });
  await Bun.write(GLOBAL_PATH, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Save project config (.mindbrain.json in project root)
 */
export async function saveProjectConfig(projectDir: string, config: ProjectConfig): Promise<void> {
  const filePath = join(projectDir, PROJECT_FILE);
  await Bun.write(filePath, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Legacy compat — saveConfig writes both global + project
 */
export async function saveConfig(config: Config): Promise<void> {
  await saveGlobalConfig({ apiUrl: config.apiUrl });
  // Also save legacy global for backwards compat
  const { mkdir } = await import("fs/promises");
  await mkdir(GLOBAL_DIR, { recursive: true });
  await Bun.write(GLOBAL_PATH, JSON.stringify(config, null, 2) + "\n");
}
