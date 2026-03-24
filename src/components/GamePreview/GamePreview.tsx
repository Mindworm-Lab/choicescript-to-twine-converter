import { useReducer, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { useProjectStore } from "../../store/projectStore";
import type { GameProject, Block, ChoiceOption, IfBranch, Condition, StatChartEntry, ExportStyle } from "../../types";
import styles from "./GamePreview.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface StatEntry {
  display: "text" | "percent";
  variable: string;
  label: string;
  value: string | number | boolean;
  maxVariable?: string;
}

interface OutputItem {
  id: string;
  type: "text" | "scene_change" | "hr" | "stat_chart" | "image";
  text?: string;
  image?: {
    src: string;
    align: "left" | "right" | "center" | "none";
  };
  statChart?: {
    title: string;
    entries: StatEntry[];
  };
}

interface RenderedOption {
  id: string;
  text: string;
  visible: boolean;
  selectable: boolean;
  optionBlocks: Block[];
}

interface GameState {
  variables: Record<string, string | number | boolean>;
  sceneId: string;
  pendingBlocks: Block[];
  output: OutputItem[];
  status: "running" | "waiting_choice" | "scene_end" | "game_end" | "error";
  choices?: RenderedOption[];
  errorMsg?: string;
  stepCount: number;
}

type GameAction =
  | { type: "STEP"; project: GameProject }
  | { type: "CHOOSE"; optionBlocks: Block[] }
  | { type: "RESTART"; project: GameProject };

// ── Condition evaluation ──────────────────────────────────────────────────────

function coerce(val: string | number | boolean, ref: string): string | number | boolean {
  if (typeof val === "boolean") {
    if (ref === "true") return true;
    if (ref === "false") return false;
    return val;
  }
  if (typeof val === "number") return Number(ref);
  return ref.replace(/^"|"$/g, "");
}

function evalSimpleCondition(cond: Condition, vars: Record<string, string | number | boolean>): boolean {
  const left = vars[cond.variable];
  if (left === undefined) return false;
  const right = coerce(left, cond.value);
  switch (cond.operator) {
    case "=":  return left == right;
    case "!=": return left != right;
    case "<":  return (left as number) < (right as number);
    case "<=": return (left as number) <= (right as number);
    case ">":  return (left as number) > (right as number);
    case ">=": return (left as number) >= (right as number);
  }
}

function evalConditionRaw(raw: string, vars: Record<string, string | number | boolean>): boolean {
  try {
    let expr = raw;
    const varNames = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const name of varNames) {
      const v = vars[name];
      const replacement = typeof v === "string" ? `"${v}"` : String(v);
      expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), replacement);
    }
    expr = expr
      .replace(/\band\b/gi, "&&")
      .replace(/\bor\b/gi, "||")
      .replace(/\bnot\b/gi, "!")
      .replace(/([^!<>])=([^=])/g, "$1==$2");
    return Boolean(new Function(`"use strict"; return (${expr});`)());
  } catch {
    return true;
  }
}

function evalBranchCondition(
  branch: IfBranch,
  vars: Record<string, string | number | boolean>
): boolean {
  if (branch.condition === null) return true; // *else
  if (branch.conditionMode === "advanced") return evalConditionRaw(branch.conditionRaw, vars);
  return evalSimpleCondition(branch.condition, vars);
}

function evalOptionCondition(
  option: ChoiceOption,
  vars: Record<string, string | number | boolean>
): boolean {
  if (option.conditionMode === "advanced") {
    if (!option.conditionRaw.trim()) return true;
    return evalConditionRaw(option.conditionRaw, vars);
  }
  if (option.conditions.length === 0) return true;
  return option.conditions.every(c => evalSimpleCondition(c, vars));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function interpolate(
  text: string,
  vars: Record<string, string | number | boolean>
): string {
  return text.replace(/\$\{(\w+)\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `\${${name}}`
  );
}

function initFromProject(project: GameProject): GameState {
  const vars: Record<string, string | number | boolean> = {};
  for (const v of project.variables) {
    vars[v.name] = v.defaultValue;
  }
  const firstScene = project.scenes[0];
  return {
    variables: vars,
    sceneId: firstScene?.id ?? "",
    pendingBlocks: firstScene ? [...firstScene.blocks] : [],
    output: [],
    status: firstScene ? "running" : "error",
    stepCount: 0,
  };
}

function evalValue(
  value: string,
  vars: Record<string, string | number | boolean>
): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (!isNaN(Number(value))) return Number(value);
  // Strip string literal quotes
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  // Direct variable reference (bare word)
  if (/^\w+$/.test(value) && vars[value] !== undefined) return vars[value];
  // Expression with variable substitution
  try {
    let expr = value;
    const varNames = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const name of varNames) {
      const v = vars[name];
      const rep = typeof v === "string" ? `"${v}"` : String(v);
      expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), rep);
    }
    const result = new Function(`"use strict"; return (${expr});`)();
    if (typeof result === "number" || typeof result === "boolean") return result;
    return String(result);
  } catch {
    return value;
  }
}

function applySet(
  vars: Record<string, string | number | boolean>,
  block: Extract<Block, { kind: "set" }>
): Record<string, string | number | boolean> {
  const updated = { ...vars };
  const evaluated = evalValue(block.value, vars);
  const cur = updated[block.variable] ?? 0;
  switch (block.operator) {
    case "=":  updated[block.variable] = evaluated; break;
    case "+=": updated[block.variable] = (cur as number) + (evaluated as number); break;
    case "-=": updated[block.variable] = (cur as number) - (evaluated as number); break;
    case "*=": updated[block.variable] = (cur as number) * (evaluated as number); break;
    case "/=": updated[block.variable] = (cur as number) / (evaluated as number); break;
  }
  return updated;
}

/** Walk all scene blocks and collect unique stat_chart entries (deduped by variable).
 *  Variables referenced as maxVariable by another entry are excluded (they're denominators). */
function getSidebarFields(project: GameProject): StatChartEntry[] {
  const seen = new Set<string>();
  const fields: StatChartEntry[] = [];

  function collect(blocks: Block[]) {
    for (const block of blocks) {
      if (block.kind === "stat_chart") {
        for (const e of block.entries) {
          if (!seen.has(e.variable)) {
            seen.add(e.variable);
            fields.push(e);
          }
        }
      } else if (block.kind === "if") {
        for (const br of block.branches) collect(br.blocks);
      } else if (block.kind === "choice") {
        for (const opt of block.options) collect(opt.blocks);
      }
    }
  }

  for (const scene of project.scenes) collect(scene.blocks);

  // Remove any variable that is purely a denominator for another entry
  const maxVars = new Set(fields.filter(f => f.maxVariable).map(f => f.maxVariable!));
  return fields.filter(f => !maxVars.has(f.variable));
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function stepOnce(state: GameState, project: GameProject): GameState {
  if (state.status !== "running") return state;
  if (state.pendingBlocks.length === 0) {
    return { ...state, status: "scene_end" };
  }
  if (state.stepCount > 2000) {
    return { ...state, status: "error", errorMsg: "Execution limit reached (possible infinite loop)." };
  }

  const [block, ...rest] = state.pendingBlocks;

  switch (block.kind) {
    case "paragraph": {
      if (!block.text.trim()) return { ...state, pendingBlocks: rest, stepCount: state.stepCount + 1 };
      return {
        ...state,
        pendingBlocks: rest,
        output: [...state.output, { id: nanoid(), type: "text", text: block.text }],
        stepCount: state.stepCount + 1,
      };
    }

    case "image": {
      if (!block.src.trim()) return { ...state, pendingBlocks: rest, stepCount: state.stepCount + 1 };
      return {
        ...state,
        pendingBlocks: rest,
        output: [...state.output, {
          id: nanoid(),
          type: "image",
          image: { src: block.src, align: block.align },
        }],
        stepCount: state.stepCount + 1,
      };
    }

    case "comment":
    case "label":
      return { ...state, pendingBlocks: rest, stepCount: state.stepCount + 1 };

    case "finish":
      return { ...state, pendingBlocks: [], status: "scene_end" };

    case "ending":
      return { ...state, pendingBlocks: [], status: "game_end" };

    case "stat_chart": {
      const resolved: StatEntry[] = block.entries.map(e => ({
        display: e.display,
        variable: e.variable,
        label: e.label || e.variable,
        value: state.variables[e.variable] ?? "—",
        maxVariable: e.maxVariable,
      }));
      return {
        ...state,
        pendingBlocks: rest,
        output: [...state.output, {
          id: nanoid(),
          type: "stat_chart" as const,
          statChart: { title: block.title, entries: resolved },
        }],
        stepCount: state.stepCount + 1,
      };
    }

    case "set": {
      const updated = applySet(state.variables, block);
      return { ...state, variables: updated, pendingBlocks: rest, stepCount: state.stepCount + 1 };
    }

    case "goto": {
      const scene = project.scenes.find(s => s.id === state.sceneId);
      const labelIdx = scene?.blocks.findIndex(b => b.kind === "label" && b.name === block.label) ?? -1;
      if (labelIdx >= 0 && scene) {
        return { ...state, pendingBlocks: scene.blocks.slice(labelIdx + 1), stepCount: state.stepCount + 1 };
      }
      return { ...state, pendingBlocks: rest, stepCount: state.stepCount + 1 };
    }

    case "goto_scene": {
      const target = project.scenes.find(s => s.filename === block.sceneName);
      if (!target) {
        return {
          ...state,
          pendingBlocks: rest,
          output: [...state.output, { id: nanoid(), type: "scene_change", text: `[Scene not found: ${block.sceneName}]` }],
          stepCount: state.stepCount + 1,
        };
      }
      let startBlocks = target.blocks;
      if (block.label) {
        const labelIdx = target.blocks.findIndex(b => b.kind === "label" && b.name === block.label);
        if (labelIdx >= 0) startBlocks = target.blocks.slice(labelIdx + 1);
      }
      return {
        ...state,
        sceneId: target.id,
        pendingBlocks: [...startBlocks],
        output: [...state.output, { id: nanoid(), type: "hr" }],
        stepCount: state.stepCount + 1,
      };
    }

    case "if": {
      const matching = block.branches.find(br => evalBranchCondition(br, state.variables));
      const injected = matching ? [...matching.blocks, ...rest] : rest;
      return { ...state, pendingBlocks: injected, stepCount: state.stepCount + 1 };
    }

    case "choice": {
      const rendered: RenderedOption[] = block.options.map(opt => {
        const condMet = evalOptionCondition(opt, state.variables);
        return {
          id: opt.id,
          text: opt.text,
          visible: opt.visibility === "if" ? condMet : true,
          selectable: condMet,
          optionBlocks: opt.blocks,
        };
      });
      return {
        ...state,
        pendingBlocks: rest,
        status: "waiting_choice",
        choices: rendered,
      };
    }

    default:
      return { ...state, pendingBlocks: rest, stepCount: state.stepCount + 1 };
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "STEP":
      return stepOnce(state, action.project);
    case "CHOOSE": {
      const newState: GameState = {
        ...state,
        status: "running",
        choices: undefined,
        pendingBlocks: [...action.optionBlocks, ...state.pendingBlocks],
        stepCount: state.stepCount + 1,
      };
      return newState;
    }
    case "RESTART":
      return initFromProject(action.project);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GamePreviewProps {
  exportStyle?: ExportStyle;
  showSidebar?: boolean;
}

export default function GamePreview({ exportStyle, showSidebar = false }: GamePreviewProps) {
  const project = useProjectStore(s => s.project);
  const [state, dispatch] = useReducer(reducer, project, initFromProject);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-step while running (process blocks eagerly, stop at choice/end)
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setTimeout(() => dispatch({ type: "STEP", project }), 0);
    return () => clearTimeout(id);
  }, [state, project]);

  // Scroll output to bottom on new content
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.output, state.choices]);

  function handleChoice(optionBlocks: Block[]) {
    dispatch({ type: "CHOOSE", optionBlocks });
  }

  function handleRestart() {
    dispatch({ type: "RESTART", project });
  }

  const currentScene = project.scenes.find(s => s.id === state.sceneId);

  // Inline styles from ExportStyle
  const containerStyle: React.CSSProperties = exportStyle ? {
    color: exportStyle.storyText,
    fontFamily: exportStyle.fontFamily,
    fontSize: exportStyle.fontSize === "small" ? "13px" : exportStyle.fontSize === "large" ? "17px" : "15px",
    "--preview-link-color": exportStyle.accentColor,
  } as React.CSSProperties : {};

  function renderBarEntry(entry: StatEntry) {
    const rawVal = Number(entry.value) || 0;
    const max = entry.maxVariable ? (Number(state.variables[entry.maxVariable]) || 100) : 100;
    const pct = Math.min(100, Math.max(0, (rawVal / max) * 100));
    const fillStyle: React.CSSProperties = exportStyle ? { width: `${pct}%`, background: exportStyle.barColor } : { width: `${pct}%` };
    return (
      <div className={styles.statBarWrap}>
        <div className={styles.statBarFill} style={fillStyle} />
        <span className={styles.statBarValue}>{entry.value}</span>
      </div>
    );
  }

  function renderOutput() {
    return (
      <>
        {state.output.map(item => {
          if (item.type === "hr") return <hr key={item.id} className={styles.sceneBreak} />;
          if (item.type === "scene_change") return <div key={item.id} className={styles.sceneLabel}>{item.text}</div>;
          if (item.type === "image" && item.image) {
            return (
              <div key={item.id} className={`${styles.imageWrap} ${styles[`imageAlign${item.image.align[0].toUpperCase()}${item.image.align.slice(1)}`] ?? ""}`}>
                <img src={item.image.src} alt="" className={styles.imageBlock} />
              </div>
            );
          }
          if (item.type === "stat_chart" && item.statChart) {
            const { title, entries } = item.statChart;
            return (
              <div key={item.id} className={styles.statChart}>
                {title && <div className={styles.statChartTitle}>{title}</div>}
                {entries.map((e, i) => (
                  <div key={i} className={styles.statRow}>
                    <span className={styles.statRowLabel}>{e.label}</span>
                    {e.display === "percent" ? renderBarEntry(e) : (
                      <span className={styles.statRowValue}>{String(e.value)}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          }
          return (
            <p key={item.id} className={styles.paragraph}>
              {interpolate(item.text ?? "", state.variables)}
            </p>
          );
        })}

        {state.status === "waiting_choice" && state.choices && (
          <div className={styles.choiceBox}>
            {state.choices
              .filter(o => o.visible)
              .map(opt => (
                <button
                  key={opt.id}
                  className={`${styles.choiceBtn} ${!opt.selectable ? styles.disabled : ""}`}
                  onClick={() => opt.selectable && handleChoice(opt.optionBlocks)}
                  disabled={!opt.selectable}
                >
                  {interpolate(opt.text, state.variables)}
                </button>
              ))}
          </div>
        )}

        {state.status === "scene_end" && (
          <div className={styles.endMsg}>
            <span>— End of scene —</span>
            <button onClick={handleRestart}>Restart</button>
          </div>
        )}

        {state.status === "game_end" && (
          <div className={styles.endMsg}>
            <span>&#x2605; The End &#x2605;</span>
            <button onClick={handleRestart}>Play Again</button>
          </div>
        )}

        {state.status === "error" && (
          <div className={styles.errorMsg}>{state.errorMsg ?? "An error occurred."}</div>
        )}

        <div ref={outputEndRef} />
      </>
    );
  }

  if (showSidebar) {
    const sidebarFields = getSidebarFields(project);
    const sidebarStyle: React.CSSProperties = exportStyle
      ? { backgroundColor: exportStyle.sidebarBg, color: exportStyle.sidebarText }
      : {};
    const mainStyle: React.CSSProperties = exportStyle
      ? { backgroundColor: exportStyle.storyBg }
      : {};

    const textStyle: React.CSSProperties = exportStyle ? { color: exportStyle.sidebarText } : {};
    const titleStyle: React.CSSProperties = exportStyle
      ? { color: exportStyle.sidebarText, opacity: 0.6 }
      : {};

    return (
      <div className={styles.styledLayout} style={containerStyle}>
        <div className={styles.previewSidebar} style={sidebarStyle}>
          <div className={styles.previewSidebarTitle} style={titleStyle}>{project.title || "My Story"}</div>
          {sidebarFields.map((f, i) => {
            const rawVal = Number(state.variables[f.variable]) || 0;
            const max = f.maxVariable ? (Number(state.variables[f.maxVariable]) || 100) : 100;
            const pct = Math.min(100, Math.max(0, (rawVal / max) * 100));
            const fillStyle: React.CSSProperties = exportStyle
              ? { width: `${pct}%`, background: exportStyle.barColor }
              : { width: `${pct}%` };
            return (
              <div key={i} className={styles.previewSidebarRow}>
                <div className={styles.previewSidebarLabelWrap}>
                  <span className={styles.previewSidebarLabel} style={textStyle}>{f.label || f.variable}</span>
                  {f.display === "percent" && (
                    <div className={styles.previewSidebarBarWrap}>
                      <div className={styles.previewSidebarBarFill} style={fillStyle} />
                    </div>
                  )}
                </div>
                <span className={styles.previewSidebarValue} style={textStyle}>
                  {String(state.variables[f.variable] ?? "—")}
                </span>
              </div>
            );
          })}
          {sidebarFields.length === 0 && (
            <div className={styles.previewSidebarEmpty} style={textStyle}>No stat charts defined</div>
          )}
        </div>

        <div className={styles.previewMain} style={mainStyle}>
          <div className={styles.gameToolbar}>
            <span className={styles.sceneTag}>{currentScene?.filename ?? "—"}.txt</span>
            <button className={styles.restartBtn} onClick={handleRestart}>&#x21BA; Restart</button>
          </div>
          <div className={styles.gameOutput}>
            {renderOutput()}
          </div>
          <details className={styles.varInspector}>
            <summary>Variables</summary>
            <table className={styles.varTable}>
              <tbody>
                {Object.entries(state.variables).map(([k, v]) => (
                  <tr key={k}>
                    <td className={styles.varKey}>{k}</td>
                    <td className={styles.varVal}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gamePreview}>
      <div className={styles.gameToolbar}>
        <span className={styles.sceneTag}>{currentScene?.filename ?? "—"}.txt</span>
        <button className={styles.restartBtn} onClick={handleRestart}>&#x21BA; Restart</button>
      </div>

      <div className={styles.gameOutput}>
        {renderOutput()}
      </div>

      {/* Variable inspector */}
      <details className={styles.varInspector}>
        <summary>Variables</summary>
        <table className={styles.varTable}>
          <tbody>
            {Object.entries(state.variables).map(([k, v]) => (
              <tr key={k}>
                <td className={styles.varKey}>{k}</td>
                <td className={styles.varVal}>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
