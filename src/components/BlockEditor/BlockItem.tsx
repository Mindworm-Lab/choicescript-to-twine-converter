import type { Block } from "../../types";
import { useProjectStore } from "../../store/projectStore";
import ParagraphBlockEditor from "./blocks/ParagraphBlockEditor";
import ImageBlockEditor from "./blocks/ImageBlockEditor";
import ChoiceBlockEditor from "./blocks/ChoiceBlockEditor";
import IfBlockEditor from "./blocks/IfBlockEditor";
import SetBlockEditor from "./blocks/SetBlockEditor";
import GotoBlockEditor from "./blocks/GotoBlockEditor";
import GotoSceneBlockEditor from "./blocks/GotoSceneBlockEditor";
import LabelBlockEditor from "./blocks/LabelBlockEditor";
import SimpleBlockEditor from "./blocks/SimpleBlockEditor";
import StatChartBlockEditor from "./blocks/StatChartBlockEditor";
import styles from "./BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Block;
  index: number;
  blocksLength: number;
  nestLevel: number;
}

// These block kinds render their editor inline in the row (single-line)
const INLINE_KINDS = new Set(["image", "set", "goto", "goto_scene", "label", "finish", "ending", "comment"]);

export default function BlockItem({ sceneId, blockPath, block, index, blocksLength, nestLevel }: Props) {
  const deleteBlock = useProjectStore(s => s.deleteBlock);
  const moveBlock = useProjectStore(s => s.moveBlock);

  const blockFullPath = [...blockPath, index];
  const isInline = INLINE_KINDS.has(block.kind);

  function renderEditor() {
    switch (block.kind) {
      case "paragraph":
        return <ParagraphBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "image":
        return <ImageBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "choice":
        return <ChoiceBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} nestLevel={nestLevel} />;
      case "if":
        return <IfBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} nestLevel={nestLevel} />;
      case "set":
        return <SetBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "goto":
        return <GotoBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "goto_scene":
        return <GotoSceneBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "label":
        return <LabelBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "finish":
      case "ending":
      case "comment":
        return <SimpleBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
      case "stat_chart":
        return <StatChartBlockEditor sceneId={sceneId} blockPath={blockFullPath} block={block} />;
    }
  }

  return (
    <div className={styles.blockItem} data-kind={block.kind}>
      <div className={styles.blockThread} aria-hidden="true" />
      <div className={styles.blockInner}>
        <div className={styles.blockRow}>
          <span className={styles.kindBadge}>{block.kind.replace(/_/g, " ")}</span>
          {isInline
            ? <div className={styles.blockContent}>{renderEditor()}</div>
            : <span className={styles.blockRowFill} />
          }
          <div className={styles.blockActions}>
            <button
              onClick={() => index > 0 && moveBlock(sceneId, blockPath, index, index - 1)}
              disabled={index === 0}
              title="Move up"
            >↑</button>
            <button
              onClick={() => index < blocksLength - 1 && moveBlock(sceneId, blockPath, index, index + 1)}
              disabled={index >= blocksLength - 1}
              title="Move down"
            >↓</button>
            <button
              onClick={() => deleteBlock(sceneId, blockPath, index)}
              title="Delete block"
              className={styles.deleteBtn}
            >✕</button>
          </div>
        </div>
        {!isInline && (
          <div className={styles.blockBody}>{renderEditor()}</div>
        )}
      </div>
    </div>
  );
}
