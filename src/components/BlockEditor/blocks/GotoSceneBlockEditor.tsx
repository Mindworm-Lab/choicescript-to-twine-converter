import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "goto_scene" }>;
}

export default function GotoSceneBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const addScene = useProjectStore(s => s.addScene);
  const setActiveScene = useProjectStore(s => s.setActiveScene);
  const scenes = useProjectStore(s => s.project.scenes);
  const [expanded, setExpanded] = useState(!block.sceneName);

  const listId = `scene-list-${block.id}`;
  const nameExists = scenes.some(s => s.filename === block.sceneName);
  const showCreate = block.sceneName.trim() !== "" && !nameExists;

  function handleCreate() {
    const fn = block.sceneName.trim();
    addScene(fn, fn);
    // After addScene, find the new scene id and activate it
    setTimeout(() => {
      const created = useProjectStore.getState().project.scenes.find(s => s.filename === fn);
      if (created) setActiveScene(created.id);
    }, 0);
    setExpanded(false);
  }

  function collapse() { setExpanded(false); }

  if (!expanded) {
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit">
        <span className={styles.opToken}>⤻</span>{" "}
        <span className={`${styles.sceneToken} ${!nameExists && block.sceneName ? styles.unknownToken : ""}`}>
          {block.sceneName || <span className={styles.dimToken}>scene</span>}
        </span>
        {!nameExists && block.sceneName && (
          <span className={styles.unknownBadge} title="Scene doesn't exist yet">?</span>
        )}
        {block.label && (
          <> <span className={styles.opToken}>#</span><span className={styles.navToken}>{block.label}</span></>
        )}
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <datalist id={listId}>
        {scenes.map(s => (
          <option key={s.id} value={s.filename}>{s.title} ({s.filename})</option>
        ))}
      </datalist>

      <div className={styles.expandRow}>
        <input
          type="text"
          list={listId}
          value={block.sceneName}
          onChange={e => updateBlock(sceneId, blockPath, { sceneName: e.target.value })}
          onKeyDown={e => e.key === "Enter" && collapse()}
          placeholder="scene filename"
          autoFocus
        />
        <input
          type="text"
          value={block.label}
          onChange={e => updateBlock(sceneId, blockPath, { label: e.target.value })}
          onKeyDown={e => e.key === "Enter" && collapse()}
          placeholder="label (optional)"
          style={{ maxWidth: 140 }}
        />
      </div>

      {showCreate && (
        <div className={styles.createSceneRow}>
          <span className={styles.createSceneHint}>"{block.sceneName}" doesn't exist yet.</span>
          <button className={styles.createSceneBtn} onClick={handleCreate}>
            ＋ Create scene
          </button>
        </div>
      )}

      <button className={styles.collapseBtn} onClick={collapse}>Done</button>
    </div>
  );
}
