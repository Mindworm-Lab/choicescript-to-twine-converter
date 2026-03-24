import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { GameProject } from "../types";
import { generateScene } from "../codegen/generateScene";

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "project";
}

export async function exportProject(project: GameProject): Promise<string[]> {
  const warnings: string[] = [];

  // Check for startup scene
  const hasStartup = project.scenes.some(s => s.filename === "startup");
  if (!hasStartup) warnings.push("No startup scene found.");

  // Collect all labels per scene for goto validation
  for (const scene of project.scenes) {
    if (scene.blocks.length === 0) {
      warnings.push(`Scene "${scene.title}" has no blocks.`);
    }
  }

  const zip = new JSZip();
  for (const scene of project.scenes) {
    zip.file(`${scene.filename}.txt`, generateScene(scene, project));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${slug(project.title)}.zip`);

  return warnings;
}
