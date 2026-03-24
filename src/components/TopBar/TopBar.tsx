import { useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { exportProject } from "../../export/exportProject";
import { exportTwine } from "../../export/exportTwine";
import styles from "./TopBar.module.css";

type ViewMode = "editor" | "flowchart" | "style";

interface TopBarProps {
  viewMode: ViewMode;
  onSetView: (mode: ViewMode) => void;
}

export default function TopBar({ viewMode, onSetView }: TopBarProps) {
  const { project, setProjectMeta, loadProject, undo, redo } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportProject(project).then(warnings => {
      if (warnings.length > 0) {
        alert("Warnings:\n" + warnings.join("\n"));
      }
    });
  }

  function handleExportTwine() {
    const warnings = exportTwine(project);
    if (warnings.length > 0) {
      alert("Warnings:\n" + warnings.join("\n"));
    }
  }

  function handleSaveJson() {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title || "project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        loadProject(data);
      } catch {
        alert("Invalid project file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>CS</div>
      </div>
      <div className={styles.left}>
        <input
          className={styles.titleInput}
          value={project.title}
          onChange={e => setProjectMeta(e.target.value, project.author)}
          placeholder="Story Title"
        />
        <span className={styles.sep}>/</span>
        <input
          className={styles.authorInput}
          value={project.author}
          onChange={e => setProjectMeta(project.title, e.target.value)}
          placeholder="Author"
        />
      </div>
      <div className={styles.right}>
        <div className={styles.btnGroup}>
          <button
            className={`${styles.btn} ${viewMode === "editor" ? styles.btnActive : ""}`}
            onClick={() => onSetView("editor")}
            title="Block Editor"
          >≡ Editor</button>
          <button
            className={`${styles.btn} ${viewMode === "flowchart" ? styles.btnActive : ""}`}
            onClick={() => onSetView("flowchart")}
            title="Story Map"
          >⬡ Map</button>
          <button
            className={`${styles.btn} ${viewMode === "style" ? styles.btnActive : ""}`}
            onClick={() => onSetView("style")}
            title="Export Style"
          >◈ Style</button>
        </div>
        <div className={styles.btnGroup}>
          <button className={styles.btn} onClick={undo} title="Undo (Ctrl+Z)">↩ Undo</button>
          <button className={styles.btn} onClick={redo} title="Redo (Ctrl+Shift+Z)">↪ Redo</button>
        </div>
        <div className={styles.btnGroup}>
          <button className={styles.btn} onClick={handleSaveJson} title="Save as JSON">↓ Save</button>
          <button className={styles.btn} onClick={() => fileInputRef.current?.click()} title="Load JSON">↑ Load</button>
        </div>
        <div className={styles.btnGroup}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleExport} title="Export .zip">⬡ Export</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleExportTwine} title="Export as Twine HTML">⬡ Twine</button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleLoadJson} />
      </div>
    </header>
  );
}
