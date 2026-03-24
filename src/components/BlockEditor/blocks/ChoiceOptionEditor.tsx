import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import { useVariableNames } from "../../../store/selectors";
import type { ChoiceOption, Condition, Block } from "../../../types";
import BlockList from "../BlockList";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  optionIndex: number;
  option: ChoiceOption;
  nestLevel: number;
}

export default function ChoiceOptionEditor({ sceneId, blockPath, optionIndex, option, nestLevel }: Props) {
  const { updateChoiceOption, deleteChoiceOption, moveChoiceOption } = useProjectStore();
  const varNames = useVariableNames();
  const [condOpen, setCondOpen] = useState(
    option.conditions.length > 0 || option.conditionRaw.trim() !== ""
  );

  const optionsCount = useProjectStore(s => {
    const scene = s.project.scenes.find(sc => sc.id === sceneId);
    if (!scene) return 0;
    const containerPath = blockPath.slice(0, -1);
    const blockIndex = blockPath[blockPath.length - 1];
    function getNestedBlocks(blocks: Block[], path: number[]): Block[] {
      if (path.length === 0) return blocks;
      const [idx, ...rest] = path;
      if (rest.length === 0) return blocks;
      const b = blocks[idx];
      if (!b) return [];
      if (b.kind === "choice" && rest.length >= 1) {
        const [oi, ...deeper] = rest;
        const opt = b.options[oi];
        if (!opt) return [];
        if (deeper.length === 0) return opt.blocks;
        return getNestedBlocks(opt.blocks, deeper);
      }
      if (b.kind === "if" && rest.length >= 1) {
        const [bi, ...deeper] = rest;
        const branch = b.branches[bi];
        if (!branch) return [];
        if (deeper.length === 0) return branch.blocks;
        return getNestedBlocks(branch.blocks, deeper);
      }
      return [];
    }
    const containerBlocks = getNestedBlocks(scene.blocks, containerPath);
    const block = containerBlocks[blockIndex];
    return block?.kind === "choice" ? block.options.length : 0;
  });

  const hasCondition = option.conditions.length > 0 || option.conditionRaw.trim() !== "";
  const nestedBlockPath = [...blockPath.slice(0, -1), blockPath[blockPath.length - 1], optionIndex];

  function handleConditionChange(field: keyof Condition, value: string) {
    const cond = option.conditions[0] ?? { variable: "", operator: "=" as const, value: "" };
    const updated = { ...cond, [field]: value };
    updateChoiceOption(sceneId, blockPath, option.id, { conditions: [updated] });
  }

  return (
    <div className={styles.choiceOption}>
      <div className={styles.choiceOptionRow}>
        <span className={styles.optionNumber}>#{optionIndex + 1}</span>
        <input
          type="text"
          className={styles.optionTextInput}
          value={option.text}
          onChange={e => updateChoiceOption(sceneId, blockPath, option.id, { text: e.target.value })}
          placeholder="Option text…"
        />
        <button
          className={`${styles.conditionChip} ${hasCondition || condOpen ? styles.conditionChipActive : ""}`}
          onClick={() => setCondOpen(v => !v)}
          title="Toggle condition"
        >
          {condOpen ? "⚑ cond" : "cond"}
        </button>
        <div className={styles.choiceOptionActions}>
          <button
            onClick={() => optionIndex > 0 && moveChoiceOption(sceneId, blockPath, optionIndex, optionIndex - 1)}
            disabled={optionIndex === 0}
            title="Move up"
          >↑</button>
          <button
            onClick={() => optionIndex < optionsCount - 1 && moveChoiceOption(sceneId, blockPath, optionIndex, optionIndex + 1)}
            disabled={optionIndex >= optionsCount - 1}
            title="Move down"
          >↓</button>
          <button onClick={() => deleteChoiceOption(sceneId, blockPath, option.id)} title="Remove option">✕</button>
        </div>
      </div>

      {condOpen && (
        <div className={styles.conditionPanel}>
          <div className={styles.conditionPanelRow}>
            <button
              className={styles.conditionModeToggle}
              onClick={() => updateChoiceOption(sceneId, blockPath, option.id, {
                conditionMode: option.conditionMode === "simple" ? "advanced" : "simple"
              })}
            >
              {option.conditionMode}
            </button>
            {hasCondition && (
              <select
                value={option.visibility}
                onChange={e => updateChoiceOption(sceneId, blockPath, option.id, { visibility: e.target.value as "if" | "selectable_if" })}
                style={{ fontSize: 11, padding: "2px 6px" }}
              >
                <option value="if">hide if false</option>
                <option value="selectable_if">disable if false</option>
              </select>
            )}
          </div>

          {option.conditionMode === "simple" ? (
            <div className={styles.conditionRow}>
              <select
                value={option.conditions[0]?.variable ?? ""}
                onChange={e => handleConditionChange("variable", e.target.value)}
              >
                <option value="">no condition</option>
                {varNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {option.conditions[0]?.variable && (
                <>
                  <select
                    value={option.conditions[0]?.operator ?? "="}
                    onChange={e => handleConditionChange("operator", e.target.value)}
                    style={{ width: 44 }}
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value="<">&lt;</option>
                    <option value="<=">&lt;=</option>
                    <option value=">">&gt;</option>
                    <option value=">=">&gt;=</option>
                  </select>
                  <input
                    type="text"
                    value={option.conditions[0]?.value ?? ""}
                    onChange={e => handleConditionChange("value", e.target.value)}
                    placeholder="value"
                    style={{ maxWidth: 90 }}
                  />
                </>
              )}
            </div>
          ) : (
            <input
              type="text"
              className={styles.conditionRow}
              value={option.conditionRaw}
              onChange={e => updateChoiceOption(sceneId, blockPath, option.id, { conditionRaw: e.target.value })}
              placeholder="ChoiceScript expression…"
              style={{ width: "100%", padding: "3px 6px", fontSize: 12, fontFamily: "monospace" }}
            />
          )}
        </div>
      )}

      <div className={styles.choiceNested}>
        <BlockList
          sceneId={sceneId}
          blockPath={nestedBlockPath}
          blocks={option.blocks}
          nestLevel={nestLevel + 1}
        />
      </div>
    </div>
  );
}
