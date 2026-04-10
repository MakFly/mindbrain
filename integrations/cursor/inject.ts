import { join } from "path";
import { mkdir } from "fs/promises";

export async function installCursor(mindbrainDir: string): Promise<boolean> {
  const cursorDir = join(process.cwd(), ".cursor", "rules");
  const targetPath = join(cursorDir, "mindbrain.mdc");

  try {
    const existing = await Bun.file(targetPath).text();
    if (existing.includes("Mindbrain")) return false;
  } catch {}

  const templatePath = join(mindbrainDir, "integrations/cursor/mindbrain.mdc.template");
  const template = await Bun.file(templatePath).text();

  await mkdir(cursorDir, { recursive: true });
  await Bun.write(targetPath, template);
  return true;
}

export async function uninstallCursor(): Promise<boolean> {
  const targetPath = join(process.cwd(), ".cursor", "rules", "mindbrain.mdc");
  try {
    const file = Bun.file(targetPath);
    if (await file.exists()) {
      const { unlink } = await import("fs/promises");
      await unlink(targetPath);
      return true;
    }
  } catch {}
  return false;
}
