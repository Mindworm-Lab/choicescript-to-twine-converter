import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "goto" }>;
}

export default function GotoBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const [expanded, setExpanded] = useState(!block.label);

  if (!expanded) {
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit">
        <span className={styles.opToken}>→</span>{" "}
        <span className={styles.navToken}>{block.label || <span className={styles.dimToken}>label</span>}</span>
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <div className={styles.expandRow}>
        <input
          type="text"
          value={block.label}
          onChange={e => updateBlock(sceneId, blockPath, { label: e.target.value })}
          onKeyDown={e => e.key === "Enter" && setExpanded(false)}
          placeholder="label name"
          autoFocus
        />
      </div>
      <button className={styles.collapseBtn} onClick={() => setExpanded(false)}>Done</button>
    </div>
  );
}
