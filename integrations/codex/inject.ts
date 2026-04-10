import { join } from "path";

const MARKER_BEGIN = "<!-- BEGIN MINDBRAIN -->";
const MARKER_END = "<!-- END MINDBRAIN -->";

export async function installCodex(mindbrainDir: string): Promise<boolean> {
  const agentsPath = join(process.cwd(), "AGENTS.md");
  const templatePath = join(mindbrainDir, "integrations/codex/agents-md.template");
  const template = await Bun.file(templatePath).text();
  const block = `${MARKER_BEGIN}\n${template}\n${MARKER_END}`;

  try {
    const existing = await Bun.file(agentsPath).text();
    if (existing.includes(MARKER_BEGIN)) return false;
    await Bun.write(agentsPath, existing.trimEnd() + "\n\n" + block + "\n");
  } catch {
    await Bun.write(agentsPath, block + "\n");
  }
  return true;
}

export async function uninstallCodex(): Promise<boolean> {
  const agentsPath = join(process.cwd(), "AGENTS.md");
  try {
    const file = Bun.file(agentsPath);
    if (!(await file.exists())) return false;
    const content = await file.text();
    if (!content.includes(MARKER_BEGIN)) return false;

    const lines = content.split("\n");
    const result: string[] = [];
    let inBlock = false;
    for (const line of lines) {
      if (line.includes(MARKER_BEGIN)) { inBlock = true; continue; }
      if (line.includes(MARKER_END)) { inBlock = false; continue; }
      if (!inBlock) result.push(line);
    }
    await Bun.write(agentsPath, result.join("\n").trim() + "\n");
    return true;
  } catch {}
  return false;
}
