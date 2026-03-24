import type { Block } from "../../types";
import BlockItem from "./BlockItem";
import AddBlockMenu from "./AddBlockMenu";
import styles from "./BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  blocks: Block[];
  nestLevel?: number;
}

export default function BlockList({ sceneId, blockPath, blocks, nestLevel = 0 }: Props) {
  return (
    <div className={styles.blockList}>
      {blocks.length === 0 && (
        <div className={styles.emptyBlocks}>No blocks yet.</div>
      )}
      {blocks.map((block, index) => (
        <div key={block.id}>
          <BlockItem
            sceneId={sceneId}
            blockPath={blockPath}
            block={block}
            index={index}
            nestLevel={nestLevel}
          />
          <AddBlockMenu
            sceneId={sceneId}
            blockPath={blockPath}
            afterIndex={index}
          />
        </div>
      ))}
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
