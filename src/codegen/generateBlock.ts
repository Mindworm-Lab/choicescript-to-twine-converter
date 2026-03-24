import type { Block, ChoiceOption, IfBranch } from "../types";
import { generateCondition } from "./generateCondition";

export function generateBlock(block: Block, indent: number): string[] {
  const prefix = "  ".repeat(indent);

  switch (block.kind) {
    case "paragraph":
      if (!block.text) return [];
      return block.text.split("\n").map(line => prefix + line);

    case "comment":
      return [`${prefix}* ${block.text}`];

    case "label":
      return [`${prefix}*label ${block.name}`];

    case "goto":
      return [`${prefix}*goto ${block.label}`];

    case "goto_scene": {
      const sceneTarget = block.label
        ? `${block.sceneName} ${block.label}`
        : block.sceneName;
      return [`${prefix}*goto_scene ${sceneTarget}`];
    }

    case "set":
      if (block.operator === "=") {
        return [`${prefix}*set ${block.variable} ${block.value}`];
      }
      return [`${prefix}*set ${block.variable} ${block.operator}${block.value}`];

    case "finish":
      return [`${prefix}*finish`];

    case "ending":
      return [`${prefix}*ending`];

    case "choice": {
      const lines: string[] = [`${prefix}*choice`];
      for (const option of block.options) {
        lines.push(...generateChoiceOption(option, indent + 1));
      }
      return lines;
    }

    case "if": {
      const lines: string[] = [];
      for (let i = 0; i < block.branches.length; i++) {
        lines.push(...generateIfBranch(block.branches[i], i, indent));
      }
      return lines;
    }

    case "stat_chart": {
      if (block.entries.length === 0) return [];
      const lines: string[] = [`${prefix}*stat_chart`];
      for (const entry of block.entries) {
        const lbl = entry.label.trim() ? ` ${entry.label.trim()}` : "";
        lines.push(`${prefix}  ${entry.display} ${entry.variable}${lbl}`);
      }
      return lines;
    }

    default:
      return [];
  }
}

function generateChoiceOption(option: ChoiceOption, indent: number): string[] {
  const prefix = "  ".repeat(indent);
  const lines: string[] = [];

  const hasCondition = option.conditionMode === "advanced"
    ? option.conditionRaw.trim() !== ""
    : option.conditions.length > 0;

  if (hasCondition) {
    const condStr = option.conditionMode === "advanced"
      ? option.conditionRaw
      : option.conditions.map(generateCondition).join(" and ");
    lines.push(`${prefix}*${option.visibility} (${condStr}) #${option.text}`);
  } else {
    lines.push(`${prefix}#${option.text}`);
  }

  for (const block of option.blocks) {
    lines.push(...generateBlock(block, indent + 1));
  }

  return lines;
}

function generateIfBranch(branch: IfBranch, index: number, indent: number): string[] {
  const prefix = "  ".repeat(indent);
  const lines: string[] = [];

  if (branch.condition === null) {
    // *else branch
    lines.push(`${prefix}*else`);
  } else if (index === 0) {
    const condStr = branch.conditionMode === "advanced"
      ? branch.conditionRaw
      : generateCondition(branch.condition);
    lines.push(`${prefix}*if (${condStr})`);
  } else {
    const condStr = branch.conditionMode === "advanced"
      ? branch.conditionRaw
      : generateCondition(branch.condition);
    lines.push(`${prefix}*elseif (${condStr})`);
  }

  for (const block of branch.blocks) {
    lines.push(...generateBlock(block, indent + 1));
  }

  return lines;
}
