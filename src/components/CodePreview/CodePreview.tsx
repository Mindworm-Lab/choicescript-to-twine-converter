import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useActiveScene } from "../../store/selectors";
import { generateScene } from "../../codegen/generateScene";
import { parseSceneText } from "../../codegen/parseScene";
import type { Block, ChoiceOption, IfBranch, Scene, GameProject } from "../../types";
import GamePreview from "../GamePreview/GamePreview";
import styles from "./CodePreview.module.css";

type Tab = "code" | "play";
const LARGE_SCENE_DEFER_THRESHOLD = 240_000;

function getTextareaMetrics(textarea: HTMLTextAreaElement): { lineHeight: number; paddingTop: number } {
  const styles = window.getComputedStyle(textarea);
  const fontSize = Number.parseFloat(styles.fontSize) || 12;
  const lineHeightRaw = Number.parseFloat(styles.lineHeight);
  const lineHeight = Number.isFinite(lineHeightRaw) ? lineHeightRaw : fontSize * 1.65;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  return { lineHeight, paddingTop };
}

function estimateSceneTextSize(blocks: Block[]): number {
  let total = 0;

  function walk(items: Block[]) {
    for (const block of items) {
      switch (block.kind) {
        case "paragraph":
          total += block.text.length + 2;
          break;
        case "image":
          total += block.src.length + 16;
          break;
        case "comment":
          total += block.text.length + 4;
          break;
        case "choice":
          total += 12;
          for (const option of block.options) {
            total += option.text.length + 6;
            walk(option.blocks);
          }
          break;
        case "if":
          total += 8;
          for (const branch of block.branches) {
            total += branch.conditionRaw.length + 6;
            walk(branch.blocks);
          }
          break;
        case "set":
          total += block.variable.length + block.value.length + 12;
          break;
        case "label":
          total += block.name.length + 8;
          break;
        case "goto":
          total += block.label.length + 8;
          break;
        case "goto_scene":
          total += block.sceneName.length + block.label.length + 14;
          break;
        case "stat_chart":
          total += block.entries.length * 18 + 10;
          break;
        case "finish":
        case "ending":
          total += 8;
          break;
      }
    }
  }

  walk(blocks);
  return total;
}

function findBlockById(blocks: Block[], targetId: string): Block | null {
  for (const block of blocks) {
    if (block.id === targetId) return block;
    if (block.kind === "choice") {
      for (const option of block.options) {
        const found = findBlockById(option.blocks, targetId);
        if (found) return found;
      }
    }
    if (block.kind === "if") {
      for (const branch of block.branches) {
        const found = findBlockById(branch.blocks, targetId);
        if (found) return found;
      }
    }
  }
  return null;
}

function startupHeaderLineCount(project: GameProject): number {
  let count = 0;
  count += 2;
  count += 1;
  count += project.variables.length;
  if (project.variables.length > 0) count += 1;
  return count;
}

function mapChoiceOptionLines(option: ChoiceOption, startLine: number, lineMap: Map<string, number>): number {
  let produced = 1;
  let line = startLine + 1;

  for (const child of option.blocks) {
    const childLines = mapBlockLines(child, line, lineMap);
    line += childLines;
    produced += childLines;
  }

  return produced;
}

function mapIfBranchLines(branch: IfBranch, startLine: number, lineMap: Map<string, number>): number {
  let produced = 1;
  let line = startLine + 1;

  for (const child of branch.blocks) {
    const childLines = mapBlockLines(child, line, lineMap);
    line += childLines;
    produced += childLines;
  }

  return produced;
}

function mapBlockLines(block: Block, startLine: number, lineMap: Map<string, number>): number {
  switch (block.kind) {
    case "paragraph": {
      if (!block.text) return 0;
      const lines = block.text.split("\n").length;
      lineMap.set(block.id, startLine);
      return lines;
    }
    case "image":
    case "comment":
    case "label":
    case "goto":
    case "goto_scene":
    case "set":
    case "finish":
    case "ending":
      lineMap.set(block.id, startLine);
      return 1;
    case "stat_chart": {
      if (block.entries.length === 0) return 0;
      lineMap.set(block.id, startLine);
      return 1 + block.entries.length;
    }
    case "choice": {
      lineMap.set(block.id, startLine);
      let produced = 1;
      let line = startLine + 1;
      for (const option of block.options) {
        const optionLines = mapChoiceOptionLines(option, line, lineMap);
        line += optionLines;
        produced += optionLines;
      }
      return produced;
    }
    case "if": {
      lineMap.set(block.id, startLine);
      let produced = 0;
      let line = startLine;
      for (const branch of block.branches) {
        const branchLines = mapIfBranchLines(branch, line, lineMap);
        line += branchLines;
        produced += branchLines;
      }
      return produced;
    }
  }
}

function buildBlockLineMap(scene: Scene, project: GameProject): Map<string, number> {
  const lineMap = new Map<string, number>();
  let lineCursor = 1;

  if (scene.filename === "startup") {
    lineCursor += startupHeaderLineCount(project);
  }

  for (const block of scene.blocks) {
    const produced = mapBlockLines(block, lineCursor, lineMap);
    lineCursor += produced + 1;
  }

  return lineMap;
}

function lineToOffset(text: string, targetLine: number): number {
  if (targetLine <= 1) return 0;
  const lines = text.split("\n");
  const lineCount = Math.min(targetLine - 1, lines.length);
  let offset = 0;
  for (let i = 0; i < lineCount; i++) {
    offset += lines[i].length + 1;
  }
  return offset;
}

export default function CodePreview() {
  const [tab, setTab] = useState<Tab>("code");
  const activeScene = useActiveScene();

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === "code" ? styles.activeTab : ""}`}
          onClick={() => setTab("code")}
        >
          Code
        </button>
        <button
          className={`${styles.tab} ${tab === "play" ? styles.activeTab : ""}`}
          onClick={() => setTab("play")}
        >
          &#x25B6; Play
        </button>
        <span className={styles.filename}>
          {activeScene?.filename ?? "—"}.txt
        </span>
      </div>
      <div className={styles.content}>
        {tab === "code" ? <CodeEditor key={activeScene?.id ?? "none"} /> : <GamePreview />}
      </div>
    </div>
  );
}

function CodeEditor() {
  const project = useProjectStore(s => s.project);
  const activeScene = useActiveScene();
  const activeBlockId = useProjectStore(s => s.activeBlockId);
  const replaceSceneBlocks = useProjectStore(s => s.replaceSceneBlocks);
  const replaceProjectMeta = useProjectStore(s => s.replaceProjectMeta);
  const [forceLoadLargeCode, setForceLoadLargeCode] = useState(false);

  const isLargeScene = useMemo(
    () => Boolean(activeScene && estimateSceneTextSize(activeScene.blocks) > LARGE_SCENE_DEFER_THRESHOLD),
    [activeScene],
  );
  const deferLargeSceneCode = isLargeScene && !forceLoadLargeCode;

  const generatedCode = useMemo(() => {
    if (!activeScene) return "";
    if (deferLargeSceneCode) return "";
    return generateScene(activeScene, project);
  }, [activeScene, deferLargeSceneCode, project]);

  const [localCode, setLocalCode] = useState(generatedCode);
  const [isFocused, setIsFocused] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const syncedMarkerRef = useRef<HTMLDivElement>(null);
  const syncedLineBandRef = useRef<HTMLDivElement>(null);

  const syncMatch = (() => {
    if (deferLargeSceneCode || !activeScene || !activeBlockId || !generatedCode || isFocused) {
      return null;
    }

    const block = findBlockById(activeScene.blocks, activeBlockId);
    if (!block) return null;

    const lineMap = buildBlockLineMap(activeScene, project);
    const line = lineMap.get(activeBlockId);
    if (!line) return null;

    const lines = generatedCode.split("\n");
    const offset = lineToOffset(generatedCode, line);
    const matchedLength = Math.max(1, lines[Math.max(0, line - 1)]?.length ?? 1);
    return { line, offset, matchedLength };
  })();

  const updateSyncIndicator = useCallback((scrollTop: number) => {
    const marker = syncedMarkerRef.current;
    const band = syncedLineBandRef.current;
    const textarea = textareaRef.current;

    if (!marker || !band || !textarea || !syncMatch) {
      if (marker) marker.style.opacity = "0";
      if (band) band.style.opacity = "0";
      return;
    }

    const { lineHeight, paddingTop } = getTextareaMetrics(textarea);
    const lineTop = paddingTop + (syncMatch.line - 1) * lineHeight - scrollTop;
    const visible = lineTop > -lineHeight && lineTop < textarea.clientHeight;

    marker.style.height = `${lineHeight}px`;
    band.style.height = `${lineHeight}px`;

    marker.style.opacity = visible ? "1" : "0";
    band.style.opacity = visible ? "1" : "0";
    marker.style.transform = `translateY(${lineTop}px)`;
    band.style.transform = `translateY(${lineTop}px)`;
  }, [syncMatch]);

  useEffect(
    () => () => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!syncMatch) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.setSelectionRange(syncMatch.offset, syncMatch.offset + Math.max(1, syncMatch.matchedLength));

    const { lineHeight } = getTextareaMetrics(textarea);
    const targetLineIndex = Math.max(0, syncMatch.line - 1);
    textarea.scrollTop = Math.max(0, targetLineIndex * lineHeight - textarea.clientHeight * 0.35);
    updateSyncIndicator(textarea.scrollTop);
  }, [generatedCode, syncMatch, updateSyncIndicator]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    updateSyncIndicator(textarea.scrollTop);
  }, [syncMatch, updateSyncIndicator]);

  function handleCodeScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    updateSyncIndicator(e.currentTarget.scrollTop);
  }

  function scheduleParseAndUpdate(text: string) {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => {
      if (!activeScene) return;
      try {
        const result = parseSceneText(text, activeScene.filename);
        replaceSceneBlocks(activeScene.id, result.blocks);
        if (result.meta && activeScene.filename === "startup") {
          replaceProjectMeta({
            title: result.meta.title,
            author: result.meta.author,
            variables: result.meta.variables,
          });
        }
        setParseError(null);
      } catch (e) {
        setParseError(String(e));
      }
    }, 500);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setLocalCode(text);
    scheduleParseAndUpdate(text);
  }

  function handleFocus() {
    setLocalCode(generatedCode);
    setParseError(null);
    setIsFocused(true);
  }

  function handleBlur() {
    setIsFocused(false);
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    if (!activeScene) return;
    try {
      const result = parseSceneText(localCode, activeScene.filename);
      replaceSceneBlocks(activeScene.id, result.blocks);
      if (result.meta && activeScene.filename === "startup") {
        replaceProjectMeta({
          title: result.meta.title,
          author: result.meta.author,
          variables: result.meta.variables,
        });
      }
      setParseError(null);
    } catch (e) {
      setParseError(String(e));
    }
  }

  function insertImageFromUrl() {
    const rawUrl = window.prompt("Image URL", "https://picsum.photos/seed/story/900/500");
    const url = rawUrl?.trim();
    if (!url) return;

    const rawAlign = window.prompt("Alignment (left, center, right, none)", "center");
    const normalizedAlign = (rawAlign ?? "center").trim().toLowerCase();
    const align = ["left", "center", "right", "none"].includes(normalizedAlign)
      ? normalizedAlign
      : "center";

    const command = align === "none" ? `*image ${url}` : `*image ${url} ${align}`;
    const baseText = isFocused ? localCode : generatedCode;

    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? baseText.length;
    const end = textarea?.selectionEnd ?? baseText.length;

    const before = baseText.slice(0, start);
    const after = baseText.slice(end);
    const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
    const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");

    const insertion = `${needsLeadingNewline ? "\n" : ""}${command}${needsTrailingNewline ? "\n" : ""}`;
    const nextText = `${before}${insertion}${after}`;

    setIsFocused(true);
    setLocalCode(nextText);
    scheduleParseAndUpdate(nextText);

    requestAnimationFrame(() => {
      textarea?.focus();
      const nextPos = before.length + insertion.length;
      textarea?.setSelectionRange(nextPos, nextPos);
    });
  }

  return (
    <div className={styles.codeEditorWrap}>
      <div className={styles.codeTools}>
        <button className={styles.codeToolBtn} onClick={insertImageFromUrl}>
          + Insert Image URL
        </button>
        {syncMatch?.line && <span className={styles.syncedLine}>Synced line {syncMatch.line}</span>}
      </div>
      {deferLargeSceneCode ? (
        <div className={styles.largeSceneNotice}>
          <div>This scene is very large. Code view is paused to keep the editor responsive.</div>
          <button className={styles.codeToolBtn} onClick={() => setForceLoadLargeCode(true)}>
            Load Code Anyway
          </button>
        </div>
      ) : (
        <>
          {parseError && (
            <div className={styles.parseError}>
              &#x26A0; Parse error: {parseError}
            </div>
          )}
          <div className={styles.codeSurface}>
            <div ref={syncedLineBandRef} className={styles.syncedLineBand} aria-hidden="true" />
            <div ref={syncedMarkerRef} className={styles.syncedMarker} aria-hidden="true" />
            <textarea
              ref={textareaRef}
              className={styles.codeTextarea}
              value={isFocused ? localCode : generatedCode}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onScroll={handleCodeScroll}
              spellCheck={false}
              placeholder="// Add blocks to see generated code"
            />
          </div>
        </>
      )}
    </div>
  );
}
