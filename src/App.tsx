import { useEffect, useState } from "react";
import { useProjectStore } from "./store/projectStore";
import { useActiveScene } from "./store/selectors";
import { useAutoSave, loadAutosave } from "./hooks/useAutoSave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import TopBar from "./components/TopBar/TopBar";
import SceneList from "./components/Sidebar/SceneList";
import VariablePanel from "./components/Sidebar/VariablePanel";
import BlockList from "./components/BlockEditor/BlockList";
import AddBlockMenu from "./components/BlockEditor/AddBlockMenu";
import CodePreview from "./components/CodePreview/CodePreview";
import FlowchartView from "./components/FlowchartView/FlowchartView";
import StyleView from "./components/StyleView/StyleView";
import styles from "./App.module.css";

export default function App() {
  const loadProject = useProjectStore(s => s.loadProject);
  const activeScene = useActiveScene();
  const [autosavePrompt, setAutosavePrompt] = useState(false);
  const [viewMode, setViewMode] = useState<"editor" | "flowchart" | "style">("editor");

  useAutoSave();
  useKeyboardShortcuts();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const saved = await loadAutosave();
      if (!cancelled && saved) {
        setAutosavePrompt(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRestoreAutosave() {
    const saved = await loadAutosave();
    if (saved) loadProject(saved);
    setAutosavePrompt(false);
  }

  return (
    <div className={styles.appLayout}>
      {autosavePrompt && (
        <div className={styles.autosaveBar}>
          Autosaved project found.{" "}
          <button onClick={() => void handleRestoreAutosave()}>Restore</button>{" "}
          <button onClick={() => setAutosavePrompt(false)}>Dismiss</button>
        </div>
      )}
      <TopBar viewMode={viewMode} onSetView={setViewMode} />
      {viewMode === "flowchart" ? (
        <FlowchartView
          className={styles.flowchartFull}
          onOpenEditor={() => setViewMode("editor")}
        />
      ) : viewMode === "style" ? (
        <StyleView className={styles.flowchartFull} />
      ) : (
        <>
          <aside className={styles.sidebar}>
            <SceneList />
            <VariablePanel />
          </aside>
          <main className={styles.blockEditor}>
            {activeScene ? (
              <>
                <div className={styles.sceneHeader}>
                  <h2>{activeScene.title}</h2>
                </div>
                <BlockList
                  sceneId={activeScene.id}
                  blockPath={[]}
                  blocks={activeScene.blocks}
                />
                <AddBlockMenu
                  sceneId={activeScene.id}
                  blockPath={[]}
                  afterIndex={activeScene.blocks.length - 1}
                  label="+ Add Block"
                />
              </>
            ) : (
              <div className={styles.empty}>Select or create a scene to start editing.</div>
            )}
          </main>
          <aside className={styles.codePreview}>
            <CodePreview />
          </aside>
        </>
      )}
    </div>
  );
}
