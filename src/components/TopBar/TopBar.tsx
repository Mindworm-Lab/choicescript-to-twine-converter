import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { exportProject } from "../../export/exportProject";
import { exportTwine } from "../../export/exportTwine";
import { importChoiceScriptFromFiles } from "../../import/importChoiceScript";
import type { GameProject } from "../../types";
import styles from "./TopBar.module.css";

type ViewMode = "editor" | "flowchart" | "style";

interface TopBarProps {
  viewMode: ViewMode;
  onSetView: (mode: ViewMode) => void;
}

interface WritableLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileHandleLike {
  name: string;
  createWritable: () => Promise<WritableLike>;
  getFile: () => Promise<File>;
}

interface DirectoryEntryLike {
  kind: "file" | "directory";
  name: string;
  getFile?: () => Promise<File>;
}

interface DirectoryHandleLike {
  values: () => AsyncIterable<DirectoryEntryLike>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileHandleLike>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileHandleLike[]>;
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
}

async function pickExistingJsonFile(win: FilePickerWindow): Promise<FileHandleLike | null> {
  if (!win.showOpenFilePicker) return null;
  try {
    const [handle] = await win.showOpenFilePicker({
      multiple: false,
      types: [{ description: "Story Project JSON", accept: { "application/json": [".json"] } }],
    });
    return handle ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "project";
}

function suggestedProjectFileName(project: GameProject): string {
  return `${slug(project.title || "project")}.json`;
}

function isGameProject(data: unknown): data is GameProject {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<GameProject>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.author === "string" &&
    Array.isArray(candidate.scenes) &&
    Array.isArray(candidate.variables)
  );
}

function formatSavedAt(value: number | null): string {
  if (!value) return "Not saved yet";
  return `Saved ${new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function buildImportReportText(input: {
  fileCount: number;
  sceneCount: number;
  variableCount: number;
  usedSceneList: boolean;
  missingSceneListEntries: number;
  extraSceneFilesAppended: number;
  warnings: string[];
}): string {
  const lines = [
    "ChoiceScript import complete",
    "",
    `Text files scanned: ${input.fileCount}`,
    `Scenes imported: ${input.sceneCount}`,
    `Variables imported: ${input.variableCount}`,
    `*scene_list detected: ${input.usedSceneList ? "yes" : "no"}`,
  ];

  if (input.usedSceneList) {
    lines.push(`Missing scene_list files: ${input.missingSceneListEntries}`);
    lines.push(`Extra scene files appended: ${input.extraSceneFilesAppended}`);
  }

  if (input.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of input.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

export default function TopBar({ viewMode, onSetView }: TopBarProps) {
  const { project, setProjectMeta, loadProject, undo, redo } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [currentFileName, setCurrentFileName] = useState(suggestedProjectFileName(project));
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const activeHandleRef = useRef<FileHandleLike | null>(null);
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(project));

  useEffect(() => {
    const currentSnapshot = JSON.stringify(project);
    setIsDirty(currentSnapshot !== lastSavedSnapshotRef.current);
    if (!activeHandleRef.current) {
      setCurrentFileName(suggestedProjectFileName(project));
    }
  }, [project]);

  function handleExport() {
    setExportMenuOpen(false);
    exportProject(project).then(warnings => {
      if (warnings.length > 0) {
        alert("Warnings:\n" + warnings.join("\n"));
      }
    });
  }

  function handleExportTwine() {
    setExportMenuOpen(false);
    const warnings = exportTwine(project);
    if (warnings.length > 0) {
      alert("Warnings:\n" + warnings.join("\n"));
    }
  }

  function markSaved(snapshot: string, fileName: string) {
    lastSavedSnapshotRef.current = snapshot;
    setCurrentFileName(fileName);
    setLastSavedAt(Date.now());
    setIsDirty(false);
  }

  const downloadJson = useCallback((snapshot: string) => {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedProjectFileName(project);
    a.click();
    URL.revokeObjectURL(url);
    markSaved(snapshot, a.download);
  }, [project]);

  const saveProject = useCallback(async (saveAs: boolean) => {
    const snapshot = JSON.stringify(project);
    const snapshotPretty = JSON.stringify(project, null, 2);
    const pickerWindow = window as FilePickerWindow;

    try {
      let handle = activeHandleRef.current;

      if (!saveAs && !handle) {
        handle = await pickExistingJsonFile(pickerWindow);
        if (handle) activeHandleRef.current = handle;
      }

      if (!saveAs && handle) {
        const writable = await handle.createWritable();
        await writable.write(snapshotPretty);
        await writable.close();
        markSaved(snapshot, handle.name);
        return;
      }

      if (pickerWindow.showSaveFilePicker) {
        handle = await pickerWindow.showSaveFilePicker({
            suggestedName: currentFileName || suggestedProjectFileName(project),
            types: [{ description: "Story Project JSON", accept: { "application/json": [".json"] } }],
        });
        activeHandleRef.current = handle;

        const writable = await handle.createWritable();
        await writable.write(snapshotPretty);
        await writable.close();
        markSaved(snapshot, handle.name);
        return;
      }

      downloadJson(snapshot);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      alert("Save failed. Please try Save As or download JSON.");
    }
  }, [currentFileName, downloadJson, project]);

  function loadFromText(content: string, fileName: string, handle: FileHandleLike | null) {
    try {
      const parsed = JSON.parse(content);
      if (!isGameProject(parsed)) {
        alert("Invalid project file.");
        return;
      }
      loadProject(parsed);
      activeHandleRef.current = handle;
      markSaved(JSON.stringify(parsed), fileName);
    } catch {
      alert("Invalid project file.");
    }
  }

  async function handleOpenProject() {
    setOpenMenuOpen(false);
    const pickerWindow = window as FilePickerWindow;
    if (pickerWindow.showOpenFilePicker) {
      try {
        const handle = await pickExistingJsonFile(pickerWindow);
        if (!handle) return;
        const file = await handle.getFile();
        const text = await file.text();
        loadFromText(text, handle.name, handle);
        return;
      } catch {
        alert("Open failed in linked-file mode. Falling back to import mode.");
      }
    }

    fileInputRef.current?.click();
  }

  async function handleImportChoiceScriptFolder() {
    setOpenMenuOpen(false);
    const pickerWindow = window as FilePickerWindow;

    if (!pickerWindow.showDirectoryPicker) {
      alert("Folder import is not supported in this browser context. Use Open JSON instead.");
      return;
    }

    try {
      const dirHandle = await pickerWindow.showDirectoryPicker();
      const files: Array<{ name: string; text: string }> = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind !== "file") continue;
        if (!entry.name.toLowerCase().endsWith(".txt")) continue;
        if (!entry.getFile) continue;
        const file = await entry.getFile();
        files.push({ name: entry.name, text: await file.text() });
      }

      const { project: imported, warnings, report } = importChoiceScriptFromFiles(files);
      loadProject(imported);
      activeHandleRef.current = null;
      lastSavedSnapshotRef.current = JSON.stringify(imported);
      setCurrentFileName(suggestedProjectFileName(imported));
      setLastSavedAt(Date.now());
      setIsDirty(false);

      alert(buildImportReportText({
        fileCount: report.sourceTextFileCount,
        sceneCount: report.importedSceneCount,
        variableCount: report.importedVariableCount,
        usedSceneList: report.usedSceneList,
        missingSceneListEntries: report.missingSceneListEntries,
        extraSceneFilesAppended: report.extraSceneFilesAppended,
        warnings,
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      alert("Could not import ChoiceScript folder. Make sure it contains startup.txt and scene .txt files.");
    }
  }

  function handleLoadJsonFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "");
      loadFromText(text, file.name, null);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveProject]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (openMenuRef.current && !openMenuRef.current.contains(target)) {
        setOpenMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        <span className={`${styles.saveStatus} ${isDirty ? styles.unsaved : styles.saved}`}>
          {isDirty ? "Unsaved changes" : formatSavedAt(lastSavedAt)}
        </span>
        <span className={styles.currentFile} title={currentFileName}>{currentFileName}</span>
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
          <button className={styles.btn} onClick={() => void saveProject(false)} title="Save project (Ctrl+S)">↓ Save</button>
          <button className={styles.btn} onClick={() => void saveProject(true)} title="Save to a new file">⇣ Save As</button>
          <div className={styles.menuWrap} ref={openMenuRef}>
            <button
              className={styles.btn}
              onClick={() => {
                setOpenMenuOpen(v => !v);
                setExportMenuOpen(false);
              }}
              title="Open/import"
            >↑ Open ▾</button>
            {openMenuOpen && (
              <div className={styles.menuDropdown}>
                <button onClick={() => void handleOpenProject()}>Open JSON</button>
                <button onClick={() => void handleImportChoiceScriptFolder()}>Import ChoiceScript Folder</button>
              </div>
            )}
          </div>
        </div>
        <div className={styles.btnGroup}>
          <div className={styles.menuWrap} ref={exportMenuRef}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                setExportMenuOpen(v => !v);
                setOpenMenuOpen(false);
              }}
              title="Export"
            >⬡ Export ▾</button>
            {exportMenuOpen && (
              <div className={styles.menuDropdown}>
                <button onClick={handleExport}>ChoiceScript ZIP</button>
                <button onClick={handleExportTwine}>Twine HTML</button>
              </div>
            )}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleLoadJsonFallback} />
      </div>
    </header>
  );
}
