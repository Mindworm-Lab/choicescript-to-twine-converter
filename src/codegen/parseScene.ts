import { nanoid } from "nanoid";
import type { Block, ChoiceOption, IfBranch, Condition, Variable } from "../types";

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

function parseChoiceOptions(cursor: ParseCursor, level: number): ChoiceOption[] {
  const options: ChoiceOption[] = [];

  while (cursor.pos < cursor.lines.length) {
    const line = cursor.lines[cursor.pos];
    if (!line.trim()) { cursor.pos++; continue; }
    const indent = getIndentLevel(line);
    if (indent < level) break;
    const trimmed = line.trim();

    // *selectable_if (cond) #text  or  *if (cond) #text
    const condOptMatch = trimmed.match(/^\*(selectable_if|if)\s+\(([^)]+)\)\s+#(.*)$/);
    if (condOptMatch) {
      const visibility = condOptMatch[1] === "selectable_if" ? "selectable_if" : "if";
      const condStr = condOptMatch[2];
      const text = condOptMatch[3];
      cursor.pos++;
      const blocks = parseBlocksAtLevel(cursor, level + 1);
      const cond = parseConditionArg(condStr);
      options.push({
        id: nanoid(),
        text,
        conditionMode: cond.conditionMode,
        conditions: cond.condition ? [cond.condition] : [],
        conditionRaw: cond.conditionRaw,
        visibility,
        blocks,
      });
      continue;
    }

    // Plain #text
    if (trimmed.startsWith("#")) {
      const text = trimmed.slice(1);
      cursor.pos++;
      const blocks = parseBlocksAtLevel(cursor, level + 1);
      options.push({
        id: nanoid(),
        text,
        conditionMode: "simple",
        conditions: [],
        conditionRaw: "",
        visibility: "if",
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

    if (trimmed.startsWith("*choice")) {
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
  };
}

export function parseSceneText(text: string, filename: string): ParseResult {
  const lines = text.split("\n");
  const cursor: ParseCursor = { lines, pos: 0 };

  let title: string | undefined;
  let author: string | undefined;
  const variables: Variable[] = [];

  // For startup scene, extract meta from the beginning
  if (filename === "startup") {
    while (cursor.pos < cursor.lines.length) {
      const line = cursor.lines[cursor.pos].trim();
      if (!line) { cursor.pos++; continue; }

      const titleMatch = line.match(/^\*title\s+(.+)$/);
      const authorMatch = line.match(/^\*author\s+(.+)$/);
      const createMatch = line.match(/^\*create\s+(\w+)\s+(.*)$/);

      if (titleMatch) {
        title = titleMatch[1].trim();
        cursor.pos++;
      } else if (authorMatch) {
        author = authorMatch[1].trim();
        cursor.pos++;
      } else if (createMatch) {
        const name = createMatch[1];
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
        cursor.pos++;
      } else {
        break;
      }
    }
  }

  const blocks = parseBlocksAtLevel(cursor, 0);

  const result: ParseResult = { blocks };
  if (filename === "startup") {
    result.meta = { title, author, variables };
  }

  return result;
}
