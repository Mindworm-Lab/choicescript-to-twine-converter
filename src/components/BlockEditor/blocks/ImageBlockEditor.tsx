import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "image" }>;
}

export default function ImageBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const [expanded, setExpanded] = useState(!block.src);

  function summaryAlign() {
    return block.align === "none" ? "default" : block.align;
  }

  if (!expanded) {
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit">
        <span className={styles.opToken}>*image</span>{" "}
        <span className={styles.valToken}>{block.src || <span className={styles.dimToken}>image-url</span>}</span>{" "}
        <span className={styles.dimToken}>({summaryAlign()})</span>
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <div className={styles.expandRow}>
        <input
          type="text"
          value={block.src}
          onChange={e => updateBlock(sceneId, blockPath, { src: e.target.value })}
          placeholder="Image URL or relative path (e.g. images/cover.jpg)"
          autoFocus
        />
      </div>
      <div className={styles.expandRow}>
        <select
          value={block.align}
          onChange={e => updateBlock(sceneId, blockPath, { align: e.target.value as Extract<Block, { kind: "image" }>['align'] })}
        >
          <option value="none">default</option>
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </div>
      <button className={styles.collapseBtn} onClick={() => setExpanded(false)}>Done</button>
    </div>
  );
}
