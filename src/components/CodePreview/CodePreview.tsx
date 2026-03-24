import { useMemo, useState, useEffect, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useActiveScene } from "../../store/selectors";
import { generateScene } from "../../codegen/generateScene";
import { parseSceneText } from "../../codegen/parseScene";
import type { Block } from "../../types";
import GamePreview from "../GamePreview/GamePreview";
import styles from "./CodePreview.module.css";

type Tab = "code" | "play";
const LARGE_SCENE_DEFER_THRESHOLD = 240_000;

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

  useEffect(
    () => () => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    },
    [],
  );

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
          <textarea
            ref={textareaRef}
            className={styles.codeTextarea}
            value={isFocused ? localCode : generatedCode}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            spellCheck={false}
            placeholder="// Add blocks to see generated code"
          />
        </>
      )}
    </div>
  );
}
