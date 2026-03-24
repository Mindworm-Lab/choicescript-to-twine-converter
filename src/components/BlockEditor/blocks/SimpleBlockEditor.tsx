import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "finish" | "ending" | "comment" }>;
}

export default function SimpleBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const [expanded, setExpanded] = useState(block.kind === "comment" && !block.text);

  if (block.kind === "finish") {
    return <span className={styles.inlineLabel}>ends the current chapter</span>;
  }

  if (block.kind === "ending") {
    return <span className={styles.inlineLabel}>ends the game</span>;
  }

  // comment
  if (!expanded) {
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit">
        <span className={styles.opToken}>//</span>{" "}
        <span style={{ color: "var(--kind-comment)" }}>{block.text || <span className={styles.dimToken}>comment</span>}</span>
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <div className={styles.expandRow}>
        <input
          type="text"
          value={block.text}
          onChange={e => updateBlock(sceneId, blockPath, { text: e.target.value })}
          placeholder="Comment text..."
          autoFocus
        />
      </div>
      <button className={styles.collapseBtn} onClick={() => setExpanded(false)}>Done</button>
    </div>
  );
}
