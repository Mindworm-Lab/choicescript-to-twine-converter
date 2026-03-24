import { useProjectStore } from "../../../store/projectStore";
import { useVariableNames } from "../../../store/selectors";
import type { Block, IfBranch, Condition } from "../../../types";
import BlockList from "../BlockList";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "if" }>;
  nestLevel: number;
}

export default function IfBlockEditor({ sceneId, blockPath, block, nestLevel }: Props) {
  const { addIfBranch, updateIfBranch, deleteIfBranch } = useProjectStore();
  const varNames = useVariableNames();

  const hasElse = block.branches.some(b => b.condition === null);

  function handleConditionChange(branch: IfBranch, field: keyof Condition, value: string) {
    const cond = branch.condition ?? { variable: "", operator: "=" as const, value: "" };
    updateIfBranch(sceneId, blockPath, branch.id, {
      condition: { ...cond, [field]: value }
    });
  }

  function handleAddElse() {
    const store = useProjectStore.getState();
    store.addIfBranch(sceneId, blockPath);
    const updatedScene = useProjectStore.getState().project.scenes.find(s => s.id === sceneId);
    if (!updatedScene) return;
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
    const containerBlocks = getNestedBlocks(updatedScene.blocks, containerPath);
    const ifBlock = containerBlocks[blockIndex];
    if (ifBlock?.kind !== "if") return;
    const newBranch = ifBlock.branches[ifBlock.branches.length - 1];
    if (newBranch) {
      store.updateIfBranch(sceneId, blockPath, newBranch.id, { condition: null });
    }
  }

  return (
    <div>
      {block.branches.map((branch, i) => {
        const isElse = branch.condition === null;
        const label = i === 0 ? "*if" : isElse ? "*else" : "*elseif";
        const nestedBlockPath = [...blockPath.slice(0, -1), blockPath[blockPath.length - 1], i];

        return (
          <div key={branch.id} className={styles.ifBranch}>
            <div className={styles.ifBranchRow}>
              <span className={styles.branchKeyword}>{label}</span>

              {!isElse && (
                <div className={styles.ifBranchCondition}>
                  <button
                    className={styles.conditionModeToggle}
                    onClick={() => updateIfBranch(sceneId, blockPath, branch.id, {
                      conditionMode: branch.conditionMode === "simple" ? "advanced" : "simple"
                    })}
                  >
                    {branch.conditionMode}
                  </button>

                  {branch.conditionMode === "simple" ? (
                    <div className={styles.conditionRow}>
                      <select
                        value={branch.condition?.variable ?? ""}
                        onChange={e => handleConditionChange(branch, "variable", e.target.value)}
                      >
                        <option value="">— variable —</option>
                        {varNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <select
                        value={branch.condition?.operator ?? "="}
                        onChange={e => handleConditionChange(branch, "operator", e.target.value)}
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
                        value={branch.condition?.value ?? ""}
                        onChange={e => handleConditionChange(branch, "value", e.target.value)}
                        placeholder="value"
                        style={{ maxWidth: 90 }}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={branch.conditionRaw}
                      onChange={e => updateIfBranch(sceneId, blockPath, branch.id, { conditionRaw: e.target.value })}
                      placeholder="condition expression…"
                      style={{ flex: 1, padding: "3px 7px", fontSize: 12, fontFamily: "monospace",
                               border: "1px solid var(--editor-border)", borderRadius: 4,
                               background: "var(--editor-raised)", color: "var(--editor-text)" }}
                    />
                  )}
                </div>
              )}

              {isElse && <span className={styles.blockRowFill} />}

              <div className={styles.ifBranchActions}>
                {block.branches.length > 1 && (
                  <button onClick={() => deleteIfBranch(sceneId, blockPath, branch.id)} title="Remove branch">✕</button>
                )}
              </div>
            </div>

            <div className={styles.ifNested}>
              <BlockList
                sceneId={sceneId}
                blockPath={nestedBlockPath}
                blocks={branch.blocks}
                nestLevel={nestLevel + 1}
              />
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button className={styles.sectionBtn} onClick={() => addIfBranch(sceneId, blockPath)}>
          + Elseif
        </button>
        {!hasElse && (
          <button className={styles.sectionBtn} onClick={handleAddElse}>
            + Else
          </button>
        )}
      </div>
    </div>
  );
}
