import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { Variable } from "../../types";
import styles from "./Sidebar.module.css";

export default function VariablePanel() {
  const { project, addVariable, deleteVariable } = useProjectStore();
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState<Partial<Variable>>({ type: "number", defaultValue: 0 });

  function handleAdd() {
    if (!draft.name?.trim()) return;
    addVariable(draft);
    setDraft({ type: "number", defaultValue: 0 });
    setAdding(false);
  }

  function defaultForType(type: Variable["type"]): string | number | boolean {
    if (type === "number") return 0;
    if (type === "boolean") return false;
    return "";
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span>Variables</span>
        <div className={styles.sectionActions}>
          <button onClick={() => setCollapsed(v => !v)} title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? "▸" : "▾"}
          </button>
          <button onClick={() => setAdding(!adding)} title="Add variable">+</button>
        </div>
      </div>

      {!collapsed && adding && (
        <div className={styles.addForm}>
          <input
            placeholder="variable name"
            value={draft.name ?? ""}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
          />
          <select
            value={draft.type}
            onChange={e => {
              const type = e.target.value as Variable["type"];
              setDraft({ ...draft, type, defaultValue: defaultForType(type) });
            }}
          >
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="string">string</option>
          </select>
          <input
            placeholder="default value"
            value={String(draft.defaultValue ?? "")}
            onChange={e => {
              let val: string | number | boolean = e.target.value;
              if (draft.type === "number") val = Number(val) || 0;
              if (draft.type === "boolean") val = val === "true";
              setDraft({ ...draft, defaultValue: val });
            }}
          />
          <div className={styles.addButtons}>
            <button onClick={handleAdd}>Add</button>
            <button onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!collapsed && <ul className={styles.list}>
        {project.variables.map(v => (
          <li key={v.id} className={styles.listItem}>
            <div className={styles.varInfo}>
              <span className={styles.varName}>{v.name}</span>
              <span className={styles.varMeta}>{v.type}: {String(v.defaultValue)}</span>
            </div>
            <div className={styles.itemActions}>
              <button
                onClick={() => deleteVariable(v.id)}
                title="Delete variable"
              >&#x1F5D1;</button>
            </div>
          </li>
        ))}
      </ul>}
    </div>
  );
}
