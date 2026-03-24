import { nanoid } from "nanoid";
import { useProjectStore } from "../../../store/projectStore";
import { useVariableNames } from "../../../store/selectors";
import type { Block, StatChartEntry } from "../../../types";
import styles from "../BlockEditor.module.css";

interface Props {
  sceneId: string;
  blockPath: number[];
  block: Extract<Block, { kind: "stat_chart" }>;
}

export default function StatChartBlockEditor({ sceneId, blockPath, block }: Props) {
  const updateBlock = useProjectStore(s => s.updateBlock);
  const varNames = useVariableNames();

  function updateEntries(entries: StatChartEntry[]) {
    updateBlock(sceneId, blockPath, { entries } as Partial<Block>);
  }

  function addEntry() {
    updateEntries([
      ...block.entries,
      { id: nanoid(), display: "text", variable: varNames[0] ?? "", label: "" },
    ]);
  }

  function updateEntry(id: string, patch: Partial<StatChartEntry>) {
    updateEntries(block.entries.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function removeEntry(id: string) {
    updateEntries(block.entries.filter(e => e.id !== id));
  }

  function moveEntry(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= block.entries.length) return;
    const arr = [...block.entries];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    updateEntries(arr);
  }

  return (
    <div className={styles.statChartEditor}>
      <div className={styles.blockEditorRow}>
        <label>Title</label>
        <input
          type="text"
          value={block.title}
          onChange={e => updateBlock(sceneId, blockPath, { title: e.target.value } as Partial<Block>)}
          placeholder="e.g. Combat Stats (optional)"
          style={{ flex: 1 }}
        />
      </div>

      <div className={styles.statChartEntries}>
        {block.entries.length === 0 && (
          <p className={styles.inlineLabel}>No entries yet — add a stat row below.</p>
        )}
        {block.entries.map((entry, idx) => (
          <div key={entry.id} className={styles.statChartEntry}>
            <select
              value={entry.display}
              onChange={e => updateEntry(entry.id, { display: e.target.value as "text" | "percent" })}
              className={styles.statChartDisplay}
            >
              <option value="text">text</option>
              <option value="percent">percent</option>
            </select>
            <select
              value={entry.variable}
              onChange={e => updateEntry(entry.id, { variable: e.target.value })}
              className={styles.statChartVar}
            >
              <option value="">— var —</option>
              {varNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input
              type="text"
              value={entry.label}
              onChange={e => updateEntry(entry.id, { label: e.target.value })}
              placeholder="Display label"
              className={styles.statChartLabel}
            />
            {entry.display === "percent" && (
              <select
                value={entry.maxVariable ?? ""}
                onChange={e => updateEntry(entry.id, { maxVariable: e.target.value || undefined })}
                className={styles.statChartVar}
                title="Max variable — bar shows value/max × 100%"
              >
                <option value="">÷ max</option>
                {varNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <div className={styles.statChartEntryActions}>
              <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0}>↑</button>
              <button onClick={() => moveEntry(idx, 1)} disabled={idx === block.entries.length - 1}>↓</button>
              <button onClick={() => removeEntry(entry.id)} className={styles.deleteBtn}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <button className={styles.sectionBtn} onClick={addEntry}>+ Add Stat Row</button>
    </div>
  );
}
