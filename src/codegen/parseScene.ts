import { nanoid } from "nanoid";
import type { Block, ChoiceOption, IfBranch, Condition, Variable, Achievement } from "../types";

interface ParseCursor {
  lines: string[];
  pos: number;
}

function getIndentLevel(line: string): number {
  let spaces = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === " ") spaces++;
    else break;
  }
  return Math.floor(spaces / 2);
}

function tryParseSimpleCondition(condStr: string): Condition | null {
  const m = condStr.trim().match(/^(\w+)\s*(!=|<=|>=|<|>|=)\s*(.+)$/);
  if (!m) return null;
  return {
    variable: m[1],
    operator: m[2] as Condition["operator"],
    value: m[3].trim(),
  };
}

function parseConditionArg(condStr: string): { conditionMode: "simple" | "advanced"; condition: Condition | null; conditionRaw: string } {
  const simple = tryParseSimpleCondition(condStr);
  if (simple) {
    return { conditionMode: "simple", condition: simple, conditionRaw: "" };
  }
  return { conditionMode: "advanced", condition: null, conditionRaw: condStr };
}

function parseSetBlock(trimmed: string): Block {
  const rest = trimmed.slice(5).trim();
  const spaceIdx = rest.indexOf(" ");
  if (spaceIdx === -1) {
    return { kind: "set", id: nanoid(), variable: rest, operator: "=", value: "" };
  }
  const varName = rest.slice(0, spaceIdx);
  const rhs = rest.slice(spaceIdx + 1).trim();
  const opMatch = rhs.match(/^([+\-*/])=(.*)$/);
  if (opMatch) {
    const op = `${opMatch[1]}=` as "+=" | "-=" | "*=" | "/=";
    return { kind: "set", id: nanoid(), variable: varName, operator: op, value: opMatch[2].trim() };
  }
  return { kind: "set", id: nanoid(), variable: varName, operator: "=", value: rhs };
}

function stripReusePrefix(trimmed: string): string {
  return trimmed.replace(/^\*(hide_reuse|disable_reuse|allow_reuse)\s+/i, "");
}

function parseChoiceOptionLine(rawTrimmed: string): {
  text: string;
  visibility: "if" | "selectable_if";
  conditionMode: "simple" | "advanced";
  conditions: Condition[];
  conditionRaw: string;
} | null {
  const trimmed = stripReusePrefix(rawTrimmed);

  const condOptMatch = trimmed.match(/^\*(selectable_if|if)\s+\(([^)]+)\)\s+#(.*)$/);
  if (condOptMatch) {
    const visibility = condOptMatch[1] === "selectable_if" ? "selectable_if" : "if";
    const cond = parseConditionArg(condOptMatch[2]);
    return {
      text: condOptMatch[3],
      visibility,
      conditionMode: cond.conditionMode,
      conditions: cond.condition ? [cond.condition] : [],
      conditionRaw: cond.conditionRaw,
    };
  }

  if (trimmed.startsWith("#")) {
    return {
      text: trimmed.slice(1),
      visibility: "if",
      conditionMode: "simple",
      conditions: [],
      conditionRaw: "",
    };
  }

  return null;
}

function parseChoiceOptions(cursor: ParseCursor, level: number): ChoiceOption[] {
  const options: ChoiceOption[] = [];

  while (cursor.pos < cursor.lines.length) {
    const line = cursor.lines[cursor.pos];
    if (!line.trim()) { cursor.pos++; continue; }
    const indent = getIndentLevel(line);
    if (indent < level) break;
    const trimmed = line.trim();

    const parsedOption = parseChoiceOptionLine(trimmed);
    if (parsedOption) {
      cursor.pos++;
      const blocks = parseBlocksAtLevel(cursor, level + 1);
      options.push({
        id: nanoid(),
        text: parsedOption.text,
        conditionMode: parsedOption.conditionMode,
        conditions: parsedOption.conditions,
        conditionRaw: parsedOption.conditionRaw,
        visibility: parsedOption.visibility,
        blocks,
      });
      continue;
    }

    break;
  }

  return options;
}

function parseIfBlock(cursor: ParseCursor, level: number): Block {
  const branches: IfBranch[] = [];

  while (cursor.pos < cursor.lines.length) {
    const line = cursor.lines[cursor.pos];
    if (!line.trim()) { cursor.pos++; continue; }
    const indent = getIndentLevel(line);
    if (indent < level) break;
    const trimmed = line.trim();

    const ifMatch = trimmed.match(/^\*if\s+\(([^)]+)\)/);
    const elseifMatch = trimmed.match(/^\*elseif\s+\(([^)]+)\)/);

    if (branches.length === 0 && ifMatch) {
      const cond = parseConditionArg(ifMatch[1]);
      cursor.pos++;
      const blocks = parseBlocksAtLevel(cursor, level + 1);
      branches.push({ id: nanoid(), ...cond, blocks });
    } else if (branches.length > 0 && elseifMatch) {
      const cond = parseConditionArg(elseifMatch[1]);
      cursor.pos++;
      const blocks = parseBlocksAtLevel(cursor, level + 1);
      branches.push({ id: nanoid(), ...cond, blocks });
    } else if (branches.length > 0 && trimmed === "*else") {
      cursor.pos++;
      const blocks = parseBlocksAtLevel(cursor, level + 1);
      branches.push({ id: nanoid(), conditionMode: "simple", condition: null, conditionRaw: "", blocks });
    } else {
      break;
    }
  }

  if (branches.length === 0) {
    branches.push({ id: nanoid(), conditionMode: "simple", condition: { variable: "", operator: "=", value: "" }, conditionRaw: "", blocks: [] });
  }

  return { kind: "if", id: nanoid(), branches };
}

function parseBlocksAtLevel(cursor: ParseCursor, level: number): Block[] {
  const blocks: Block[] = [];

  while (cursor.pos < cursor.lines.length) {
    const line = cursor.lines[cursor.pos];
    if (!line.trim()) { cursor.pos++; continue; }

    const indent = getIndentLevel(line);
    if (indent < level) break;

    const trimmed = line.trim();

    // Skip startup meta commands
    if (trimmed.match(/^\*(title|author|create)\s/)) {
      cursor.pos++;
      continue;
    }

    if (trimmed === "*scene_list" || trimmed.startsWith("*scene_list ")) {
      const sceneListIndent = indent;
      cursor.pos++;
      while (cursor.pos < cursor.lines.length) {
        const sceneLine = cursor.lines[cursor.pos];
        const sceneTrimmed = sceneLine.trim();

        if (!sceneTrimmed) {
          cursor.pos++;
          continue;
        }

        const sceneIndent = getIndentLevel(sceneLine);
        if (sceneIndent <= sceneListIndent) break;
        cursor.pos++;
      }
      continue;
    }

    if (trimmed.startsWith("*achievement ")) {
      const achievementIndent = indent;
      cursor.pos++;

      while (cursor.pos < cursor.lines.length) {
        const descLine = cursor.lines[cursor.pos];
        const descTrimmed = descLine.trim();

        if (!descTrimmed) {
          cursor.pos++;
          continue;
        }

        const descIndent = getIndentLevel(descLine);
        if (descIndent <= achievementIndent) break;
        if (descTrimmed.startsWith("*") || descTrimmed.startsWith("#")) break;

        cursor.pos++;
      }
      continue;
    }

    if (trimmed === "*stat_chart") {
      cursor.pos++;
      const entries: import("../types").StatChartEntry[] = [];
      while (cursor.pos < cursor.lines.length) {
        const entryLine = cursor.lines[cursor.pos].trim();
        if (!entryLine) { cursor.pos++; continue; }
        if (!entryLine.startsWith("text ") && !entryLine.startsWith("percent ")) break;
        const parts = entryLine.split(/\s+/);
        const display = parts[0] as "text" | "percent";
        const variable = parts[1] ?? "";
        const label = parts.slice(2).join(" ");
        entries.push({ id: nanoid(), display, variable, label });
        cursor.pos++;
      }
      blocks.push({ kind: "stat_chart", id: nanoid(), title: "", entries });
      continue;
    }

    if (trimmed.startsWith("*choice") || trimmed.startsWith("*fake_choice")) {
      cursor.pos++;
      const options = parseChoiceOptions(cursor, level + 1);
      blocks.push({ kind: "choice", id: nanoid(), options });
      continue;
    }

    if (trimmed.match(/^\*if\s+\(/)) {
      blocks.push(parseIfBlock(cursor, level));
      continue;
    }

    if (trimmed.startsWith("*set ")) {
      blocks.push(parseSetBlock(trimmed));
      cursor.pos++;
      continue;
    }

    if (trimmed.startsWith("*image ")) {
      const rest = trimmed.slice(7).trim();
      const parts = rest.split(/\s+/);
      const src = parts[0] ?? "";
      const alignRaw = parts[1] ?? "none";
      const align = ["left", "right", "center"].includes(alignRaw) ? alignRaw as "left" | "right" | "center" : "none";
      blocks.push({ kind: "image", id: nanoid(), src, align });
      cursor.pos++;
      continue;
    }

    if (trimmed.startsWith("*label ")) {
      blocks.push({ kind: "label", id: nanoid(), name: trimmed.slice(7).trim() });
      cursor.pos++;
      continue;
    }

    if (trimmed.startsWith("*goto_scene ")) {
      const rest = trimmed.slice(12).trim().split(/\s+/);
      blocks.push({ kind: "goto_scene", id: nanoid(), sceneName: rest[0] ?? "", label: rest[1] ?? "" });
      cursor.pos++;
      continue;
    }

    if (trimmed.startsWith("*goto ")) {
      blocks.push({ kind: "goto", id: nanoid(), label: trimmed.slice(6).trim() });
      cursor.pos++;
      continue;
    }

    if (trimmed === "*finish") {
      blocks.push({ kind: "finish", id: nanoid() });
      cursor.pos++;
      continue;
    }

    if (trimmed === "*ending") {
      blocks.push({ kind: "ending", id: nanoid() });
      cursor.pos++;
      continue;
    }

    if (trimmed.startsWith("* ") || trimmed === "*") {
      blocks.push({ kind: "comment", id: nanoid(), text: trimmed.slice(2) });
      cursor.pos++;
      continue;
    }

    // Unknown command — skip
    if (trimmed.startsWith("*")) {
      cursor.pos++;
      continue;
    }

    // Text paragraph — collect consecutive text lines at same indent
    if (trimmed.startsWith("#")) {
      // Option marker at wrong level — stop
      break;
    }

    const textLines: string[] = [];
    while (cursor.pos < cursor.lines.length) {
      const l = cursor.lines[cursor.pos];
      const li = getIndentLevel(l);
      const lt = l.trim();
      if (!lt) break;
      if (li < level) break;
      if (lt.startsWith("*") || lt.startsWith("#")) break;
      textLines.push(lt);
      cursor.pos++;
    }
    if (textLines.length > 0) {
      blocks.push({ kind: "paragraph", id: nanoid(), text: textLines.join("\n") });
    }
  }

  return blocks;
}

export interface ParseResult {
  blocks: Block[];
  meta?: {
    title?: string;
    author?: string;
    variables?: Variable[];
    achievements?: Achievement[];
  };
}

export function parseSceneText(text: string, filename: string): ParseResult {
  const lines = text.split("\n");
  const cursor: ParseCursor = { lines, pos: 0 };

  let title: string | undefined;
  let author: string | undefined;
  const variables: Variable[] = [];
  const achievements: Achievement[] = [];
  const seenVariables = new Set<string>();

  // For startup scene, extract meta from all lines.
  // Some projects place *scene_list before the bulk of *create commands.
  if (filename === "startup") {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (!line) continue;

      const titleMatch = line.match(/^\*title\s+(.+)$/);
      const authorMatch = line.match(/^\*author\s+(.+)$/);
      const createMatch = line.match(/^\*create\s+(\w+)\s+(.*)$/);
      const achievementMatch = line.match(/^\*achievement\s+(\w+)\s+(visible|hidden)\s+(\d+)\s+(.+)$/i);

      if (!title && titleMatch) {
        title = titleMatch[1].trim();
      } else if (!author && authorMatch) {
        author = authorMatch[1].trim();
      } else if (createMatch) {
        const name = createMatch[1];
        const normalizedName = name.toLowerCase();
        if (seenVariables.has(normalizedName)) continue;

        const rawVal = createMatch[2].trim();
        let type: Variable["type"] = "number";
        let defaultValue: string | number | boolean = 0;
        if (rawVal === "true" || rawVal === "false") {
          type = "boolean";
          defaultValue = rawVal === "true";
        } else if (!isNaN(Number(rawVal))) {
          type = "number";
          defaultValue = Number(rawVal);
        } else {
          type = "string";
          defaultValue = rawVal.replace(/^"|"$/g, "");
        }
        variables.push({ id: nanoid(), name, type, defaultValue, description: "" });
        seenVariables.add(normalizedName);
      } else if (achievementMatch) {
        const key = achievementMatch[1].trim();
        if (!key) continue;

        const visibility = achievementMatch[2].toLowerCase() === "hidden" ? "hidden" : "visible";
        const points = Number.parseInt(achievementMatch[3], 10) || 0;
        const achievementTitle = achievementMatch[4].trim();

        let beforeText = "";
        let afterText = "";

        for (let next = index + 1; next < lines.length; next++) {
          const descRaw = lines[next];
          const descTrimmed = descRaw.trim();
          if (!descTrimmed) continue;
          if (descTrimmed.startsWith("*") || descTrimmed.startsWith("#")) break;
          beforeText = descTrimmed;

          for (let after = next + 1; after < lines.length; after++) {
            const postRaw = lines[after];
            const postTrimmed = postRaw.trim();
            if (!postTrimmed) continue;
            if (postTrimmed.startsWith("*") || postTrimmed.startsWith("#")) break;
            afterText = postTrimmed;
            break;
          }
          break;
        }

        achievements.push({
          id: nanoid(),
          key,
          visibility,
          points,
          title: achievementTitle,
          beforeText,
          afterText,
        });
      }
    }
  }

  const blocks = parseBlocksAtLevel(cursor, 0);

  const result: ParseResult = { blocks };
  if (filename === "startup") {
    result.meta = { title, author, variables, achievements };
  }

  return result;
}
