import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import styles from "./Sidebar.module.css";

export default function SceneList() {
  const { project, activeSceneId, addScene, deleteScene, setActiveScene, updateSceneMeta } = useProjectStore();
  const [newFilename, setNewFilename] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleAdd() {
    if (!newFilename.trim()) return;
    addScene(newFilename.trim(), newTitle.trim() || newFilename.trim());
    setNewFilename("");
    setNewTitle("");
    setAdding(false);
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span>Scenes</span>
        <button onClick={() => setAdding(!adding)}>+</button>
      </div>

      {adding && (
        <div className={styles.addForm}>
          <input
            placeholder="filename (e.g. chapter1)"
            value={newFilename}
            onChange={e => setNewFilename(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <input
            placeholder="display title"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <div className={styles.addButtons}>
            <button onClick={handleAdd}>Add</button>
            <button onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <ul className={styles.list}>
        {project.scenes.map(scene => (
          <li
            key={scene.id}
            className={`${styles.listItem} ${scene.id === activeSceneId ? styles.active : ""}`}
            onClick={() => setActiveScene(scene.id)}
          >
            {scene.id === activeSceneId && <span className={styles.activeIndicator} />}
            {editingId === scene.id ? (
              <input
                className={styles.inlineEdit}
                defaultValue={scene.title}
                autoFocus
                onBlur={e => {
                  updateSceneMeta(scene.id, { title: e.target.value });
                  setEditingId(null);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    updateSceneMeta(scene.id, { title: (e.target as HTMLInputElement).value });
                    setEditingId(null);
                  }
                  e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <span className={styles.sceneName}>{scene.title}</span>
                <span className={styles.sceneFilename}>{scene.filename}.txt</span>
              </>
            )}
            <div className={styles.itemActions}>
              {scene.filename !== "startup" && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingId(scene.id); }}
                    title="Rename"
                  >&#x270F;</button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteScene(scene.id); }}
                    title="Delete"
                  >&#x1F5D1;</button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
