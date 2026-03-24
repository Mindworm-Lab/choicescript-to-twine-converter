import { useRef, useEffect } from "react";
import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "paragraph" }>;
}

export default function ParagraphBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [block.text]);

  return (
    <textarea
      ref={ref}
      className={styles.paragraphTextarea}
      value={block.text}
      onChange={e => updateBlock(sceneId, blockPath, { text: e.target.value })}
      placeholder="Enter paragraph text…"
    />
  );
}
