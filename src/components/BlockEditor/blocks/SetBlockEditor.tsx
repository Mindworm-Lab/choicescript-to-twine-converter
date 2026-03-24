import { useState } from "react";
import { useProjectStore } from "../../../store/projectStore";
import { useVariableNames } from "../../../store/selectors";
import type { Block } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "set" }>;
}

export default function SetBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const varNames = useVariableNames();
  const [expanded, setExpanded] = useState(!block.variable || !block.value);

  if (!expanded) {
    return (
      <div className={styles.inlineSummary} onClick={() => setExpanded(true)} title="Click to edit">
        <span className={styles.varToken}>{block.variable || "—"}</span>
        {" "}
        <span className={styles.opToken}>{block.operator}</span>
        {" "}
        <span className={styles.valToken}>{block.value || "—"}</span>
      </div>
    );
  }

  return (
    <div className={styles.expandedEditor}>
      <div className={styles.expandRow}>
        <select
          value={block.variable}
          onChange={e => updateBlock(sceneId, blockPath, { variable: e.target.value })}
        >
          <option value="">— variable —</option>
          {varNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={block.operator}
          onChange={e => updateBlock(sceneId, blockPath, { operator: e.target.value as "=" | "+=" | "-=" | "*=" | "/=" })}
          style={{ width: 52 }}
        >
          <option value="=">=</option>
          <option value="+=">+=</option>
          <option value="-=">-=</option>
          <option value="*=">*=</option>
          <option value="/=">/=</option>
        </select>
        <input
          type="text"
          value={block.value}
          onChange={e => updateBlock(sceneId, blockPath, { value: e.target.value })}
          placeholder="value or expression"
        />
      </div>
      <button className={styles.collapseBtn} onClick={() => setExpanded(false)}>Done</button>
    </div>
  );
}
