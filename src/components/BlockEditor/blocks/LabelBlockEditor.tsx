import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "label" }>;
}

export default function LabelBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const [expanded, setExpanded] = useState(!block.name);

  if (!expanded) {
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit">
        <span className={styles.opToken}>◈</span>{" "}
        <span className={styles.labelToken}>{block.name || <span className={styles.dimToken}>name</span>}</span>
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <div className={styles.expandRow}>
        <input
          type="text"
          value={block.name}
          onChange={e => updateBlock(sceneId, blockPath, { name: e.target.value })}
          onKeyDown={e => e.key === "Enter" && setExpanded(false)}
          placeholder="label name"
          autoFocus
        />
      </div>
      <button className={styles.collapseBtn} onClick={() => setExpanded(false)}>Done</button>
    </div>
  );
}
