import { useProjectStore } from "../../../store/projectStore";
import type { Block } from "../../../types";
import ChoiceOptionEditor from "./ChoiceOptionEditor";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "choice" }>;
  nestLevel: number;
}

export default function ChoiceBlockEditor({ sceneId, blockPath, block, nestLevel }: Props) {
  const addChoiceOption = useProjectStore(s => s.addChoiceOption);

  return (
    <div>
      {block.options.map((option, i) => (
        <ChoiceOptionEditor
          key={option.id}
          sceneId={sceneId}
          blockPath={blockPath}
          optionIndex={i}
          option={option}
          nestLevel={nestLevel}
        />
      ))}
      <button
        className={styles.sectionBtn}
        onClick={() => addChoiceOption(sceneId, blockPath)}
      >
        + Add Option
      </button>
    </div>
  );
}
