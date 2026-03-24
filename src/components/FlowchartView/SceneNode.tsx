import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { SceneFlowNode, SceneNodeData } from "./useFlowchartData";
import styles from "./FlowchartView.module.css";

function firstParagraphText(data: SceneNodeData["scene"]): string {
  for (const block of data.blocks) {
    if (block.kind === "paragraph" && block.text.trim()) {
      const text = block.text.trim();
      return text.length > 60 ? text.slice(0, 59) + "…" : text;
    }
  }
  return "";
}

export default function SceneNode({ data }: NodeProps<SceneFlowNode>) {
  const preview = firstParagraphText(data.scene);
  const blockCount = data.scene.blocks.length;

  return (
    <div
      className={styles.node}
      data-active={data.isActive}
      data-startup={data.isStartup}
    >
      <Handle type="target" position={Position.Left} />

      <div className={styles.nodeHeader}>
        {data.isStartup && <span className={styles.startBadge}>START</span>}
        <span className={styles.nodeTitle}>{data.scene.title || data.scene.filename}</span>
        <span className={styles.blockCount}>{blockCount}</span>
      </div>

      <div className={styles.nodeFilename}>{data.scene.filename}</div>

      {preview && <div className={styles.nodePreview}>{preview}</div>}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
