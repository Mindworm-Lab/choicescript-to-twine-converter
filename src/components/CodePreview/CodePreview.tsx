import { useMemo, useState, useEffect, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useActiveScene } from "../../store/selectors";
import { generateScene } from "../../codegen/generateScene";
import { parseSceneText } from "../../codegen/parseScene";
import GamePreview from "../GamePreview/GamePreview";
import styles from "./CodePreview.module.css";

type Tab = "code" | "play";

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
        {tab === "code" ? <CodeEditor /> : <GamePreview />}
      </div>
    </div>
  );
}

function CodeEditor() {
  const project = useProjectStore(s => s.project);
  const activeScene = useActiveScene();
  const replaceSceneBlocks = useProjectStore(s => s.replaceSceneBlocks);
  const replaceProjectMeta = useProjectStore(s => s.replaceProjectMeta);

  const generatedCode = useMemo(() => {
    if (!activeScene) return "";
    return generateScene(activeScene, project);
  }, [activeScene, project]);

  const [localCode, setLocalCode] = useState(generatedCode);
  const [isFocused, setIsFocused] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSceneIdRef = useRef(activeScene?.id);

  // When scene changes or not focused, sync textarea with generated code
  useEffect(() => {
    const sceneChanged = activeScene?.id !== activeSceneIdRef.current;
    activeSceneIdRef.current = activeScene?.id;
    if (!isFocused || sceneChanged) {
      setLocalCode(generatedCode);
      setParseError(null);
    }
  }, [generatedCode, isFocused, activeScene?.id]);

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

  return (
    <div className={styles.codeEditorWrap}>
      {parseError && (
        <div className={styles.parseError}>
          &#x26A0; Parse error: {parseError}
        </div>
      )}
      <textarea
        className={styles.codeTextarea}
        value={localCode}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        spellCheck={false}
        placeholder="// Add blocks to see generated code"
      />
    </div>
  );
}
