import type { Scene, GameProject, Variable } from "../types";
import { generateBlock } from "./generateBlock";

function serializeDefault(variable: Variable): string {
  if (variable.type === "boolean") {
    return String(variable.defaultValue).toLowerCase();
  }
  if (variable.type === "string") {
    return `"${variable.defaultValue}"`;
  }
  return String(variable.defaultValue);
}

export function generateScene(scene: Scene, project: GameProject): string {
  const lines: string[] = [];

  if (scene.filename === "startup") {
    lines.push(`*title ${project.title}`);
    lines.push(`*author ${project.author}`);
    lines.push("");

    if (project.scenes.length > 0) {
      lines.push("*scene_list");
      for (const listed of project.scenes) {
        lines.push(`  ${listed.filename}`);
      }
      lines.push("");
    }

    for (const variable of project.variables) {
      lines.push(`*create ${variable.name} ${serializeDefault(variable)}`);
    }
    if (project.variables.length > 0) lines.push("");

    for (const achievement of project.achievements) {
      lines.push(
        `*achievement ${achievement.key} ${achievement.visibility} ${achievement.points} ${achievement.title}`,
      );
      if (achievement.beforeText.trim()) lines.push(`  ${achievement.beforeText.trim()}`);
      if (achievement.afterText.trim()) lines.push(`  ${achievement.afterText.trim()}`);
    }
    if (project.achievements.length > 0) lines.push("");
  }

  for (const block of scene.blocks) {
    const blockLines = generateBlock(block, 0);
    lines.push(...blockLines);
    lines.push("");
  }

  return lines.join("\n");
}
