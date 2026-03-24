import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { Achievement } from "../../types";
import styles from "./Sidebar.module.css";

export default function AchievementsPanel() {
  const { project, addAchievement, deleteAchievement } = useProjectStore();
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState<Partial<Achievement>>({
    visibility: "visible",
    points: 5,
    key: "",
    title: "",
    beforeText: "",
    afterText: "",
  });

  function handleAdd() {
    if (!draft.key?.trim() || !draft.title?.trim()) return;
    addAchievement({
      key: draft.key.trim(),
      title: draft.title.trim(),
      visibility: draft.visibility ?? "visible",
      points: Number(draft.points) || 0,
      beforeText: draft.beforeText?.trim() ?? "",
      afterText: draft.afterText?.trim() ?? "",
    });
    setDraft({
      visibility: "visible",
      points: 5,
      key: "",
      title: "",
      beforeText: "",
      afterText: "",
    });
    setAdding(false);
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span>Achievements</span>
        <div className={styles.sectionActions}>
          <button onClick={() => setCollapsed(v => !v)} title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? "▸" : "▾"}
          </button>
          <button onClick={() => setAdding(v => !v)} title="Add achievement">+</button>
        </div>
      </div>

      {!collapsed && adding && (
        <div className={styles.addForm}>
          <input
            placeholder="key (e.g. one_for_the_road)"
            value={draft.key ?? ""}
            onChange={e => setDraft({ ...draft, key: e.target.value })}
          />
          <input
            placeholder="title"
            value={draft.title ?? ""}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
          />
          <select
            value={draft.visibility ?? "visible"}
            onChange={e => setDraft({ ...draft, visibility: e.target.value as Achievement["visibility"] })}
          >
            <option value="visible">visible</option>
            <option value="hidden">hidden</option>
          </select>
          <input
            placeholder="points"
            type="number"
            value={String(draft.points ?? 5)}
            onChange={e => setDraft({ ...draft, points: Number(e.target.value) || 0 })}
          />
          <input
            placeholder="before-earned text"
            value={draft.beforeText ?? ""}
            onChange={e => setDraft({ ...draft, beforeText: e.target.value })}
          />
          <input
            placeholder="after-earned text"
            value={draft.afterText ?? ""}
            onChange={e => setDraft({ ...draft, afterText: e.target.value })}
          />
          <div className={styles.addButtons}>
            <button onClick={handleAdd}>Add</button>
            <button onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!collapsed && (
        <ul className={styles.list}>
          {project.achievements.map(achievement => (
            <li key={achievement.id} className={styles.listItem}>
              <div className={styles.achievementInfo}>
                <span className={styles.achievementTitle}>{achievement.title}</span>
                <span className={styles.achievementMeta}>
                  {achievement.key} • {achievement.visibility} • {achievement.points} pts
                </span>
                {achievement.beforeText && (
                  <span className={styles.achievementText}>Before: {achievement.beforeText}</span>
                )}
                {achievement.afterText && (
                  <span className={styles.achievementText}>After: {achievement.afterText}</span>
                )}
              </div>
              <div className={styles.itemActions}>
                <button
                  onClick={() => deleteAchievement(achievement.id)}
                  title="Delete achievement"
                >&#x1F5D1;</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
