import { useMemo, useState } from "react";
import type { Block } from "../../types";
import BlockItem from "./BlockItem";
import AddBlockMenu from "./AddBlockMenu";
import styles from "./BlockEditor.module.css";

const ROOT_INITIAL_VISIBLE = 120;
const NESTED_INITIAL_VISIBLE = 80;
const LOAD_MORE_STEP = 80;

interface Props {
  sceneId: string;
  blockPath: number[];
  blocks: Block[];
  nestLevel?: number;
}

export default function BlockList({ sceneId, blockPath, blocks, nestLevel = 0 }: Props) {
  const initialVisible = nestLevel === 0 ? ROOT_INITIAL_VISIBLE : NESTED_INITIAL_VISIBLE;
  const [visibleCount, setVisibleCount] = useState(() => initialVisible);
  const effectiveVisibleCount = Math.min(visibleCount, blocks.length);

  const truncated = blocks.length > effectiveVisibleCount;
  const renderedBlocks = useMemo(() => blocks.slice(0, effectiveVisibleCount), [blocks, effectiveVisibleCount]);

  return (
    <div className={styles.blockList}>
      {blocks.length === 0 && (
        <div className={styles.emptyBlocks}>No blocks yet.</div>
      )}
      {renderedBlocks.map((block, index) => (
        <div key={block.id}>
          <BlockItem
            sceneId={sceneId}
            blockPath={blockPath}
            block={block}
            index={index}
            blocksLength={blocks.length}
            nestLevel={nestLevel}
          />
          <AddBlockMenu
            sceneId={sceneId}
            blockPath={blockPath}
            afterIndex={index}
          />
        </div>
      ))}

      {truncated && (
        <button
          className={styles.sectionBtn}
          onClick={() => setVisibleCount(v => Math.min(v + LOAD_MORE_STEP, blocks.length))}
          style={{ alignSelf: "flex-start", marginTop: 6 }}
        >
          Load more blocks ({blocks.length - effectiveVisibleCount} remaining)
        </button>
      )}

      {blocks.length === 0 && (
        <AddBlockMenu
          sceneId={sceneId}
          blockPath={blockPath}
          afterIndex={-1}
          label="+ Add Block"
        />
      )}
    </div>
  );
}
