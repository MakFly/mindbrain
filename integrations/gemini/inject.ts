import { join } from "path";
import { mkdir } from "fs/promises";

export async function installGemini(mindbrainDir: string): Promise<boolean> {
  const geminiDir = join(process.cwd(), ".gemini");
  const targetPath = join(geminiDir, "context.md");

  try {
    const existing = await Bun.file(targetPath).text();
    if (existing.includes("Mindbrain")) return false;
  } catch {}

  const templatePath = join(mindbrainDir, "integrations/gemini/context.template");
  const template = await Bun.file(templatePath).text();

  await mkdir(geminiDir, { recursive: true });
  await Bun.write(targetPath, template);
  return true;
}

export async function uninstallGemini(): Promise<boolean> {
  const targetPath = join(process.cwd(), ".gemini", "context.md");
  try {
    const file = Bun.file(targetPath);
    if (await file.exists()) {
      const content = await file.text();
      if (content.includes("Mindbrain")) {
        const { unlink } = await import("fs/promises");
        await unlink(targetPath);
        return true;
      }
    }
  } catch {}
  return false;
}
