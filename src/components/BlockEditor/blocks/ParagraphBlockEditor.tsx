import { useRef, useEffect, useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

const COLLAPSE_THRESHOLD = 8000;
const AUTO_SIZE_THRESHOLD = 30000;

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "paragraph" }>;
}

export default function ParagraphBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(block.text.length < COLLAPSE_THRESHOLD || !block.text);

  useEffect(() => {
    if (!expanded) return;
    if (block.text.length > AUTO_SIZE_THRESHOLD) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [expanded, block.text]);

  if (!expanded) {
    const preview = block.text.trim().slice(0, 180);
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit paragraph">
        <span className={styles.valToken}>{preview || <span className={styles.dimToken}>empty paragraph</span>}</span>
        {block.text.length > preview.length ? "…" : ""}
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <textarea
        ref={ref}
        className={styles.paragraphTextarea}
        value={block.text}
        onChange={e => updateBlock(sceneId, blockPath, { text: e.target.value })}
        placeholder="Enter paragraph text…"
      />
      {block.text.length >= COLLAPSE_THRESHOLD && (
        <button className={styles.collapseBtn} onClick={() => setExpanded(false)}>Done</button>
      )}
    </div>
  );
}
