import { useProjectStore } from "../../store/projectStore";
import { DEFAULT_EXPORT_STYLE } from "../../types";
import type { ExportStyle } from "../../types";
import GamePreview from "../GamePreview/GamePreview";
import styles from "./StyleView.module.css";

const FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "'Palatino Linotype', Palatino, serif",  label: "Palatino (default)" },
  { value: "Georgia, 'Times New Roman', serif",      label: "Georgia" },
  { value: "system-ui, -apple-system, sans-serif",   label: "System sans-serif" },
  { value: "'Courier New', Courier, monospace",      label: "Courier (monospace)" },
];

const SIZE_OPTIONS: Array<{ value: ExportStyle["fontSize"]; label: string }> = [
  { value: "small",  label: "Small" },
  { value: "medium", label: "Medium (default)" },
  { value: "large",  label: "Large" },
];

interface StyleViewProps {
  className?: string;
}

export default function StyleView({ className }: StyleViewProps) {
  const project = useProjectStore(s => s.project);
  const updateExportStyle = useProjectStore(s => s.updateExportStyle);

  const current: ExportStyle = project.exportStyle ?? DEFAULT_EXPORT_STYLE;

  function update<K extends keyof ExportStyle>(key: K, value: ExportStyle[K]) {
    updateExportStyle({ ...current, [key]: value });
  }

  return (
    <div className={`${styles.styleView} ${className ?? ""}`}>
      {/* ── Settings panel ── */}
      <aside className={styles.settingsPanel}>
        <div className={styles.panelHeader}>Export Style</div>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Colors</div>

          <ColorRow
            label="Sidebar background"
            value={current.sidebarBg}
            onChange={v => update("sidebarBg", v)}
          />
          <ColorRow
            label="Sidebar text"
            value={current.sidebarText}
            onChange={v => update("sidebarText", v)}
          />
          <ColorRow
            label="Story background"
            value={current.storyBg}
            onChange={v => update("storyBg", v)}
          />
          <ColorRow
            label="Story text"
            value={current.storyText}
            onChange={v => update("storyText", v)}
          />
          <ColorRow
            label="Accent / links"
            value={current.accentColor}
            onChange={v => update("accentColor", v)}
          />
          <ColorRow
            label="Stat bar color"
            value={current.barColor}
            onChange={v => update("barColor", v)}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Typography</div>

          <div className={styles.row}>
            <label className={styles.rowLabel}>Font</label>
            <select
              className={styles.select}
              value={current.fontFamily}
              onChange={e => update("fontFamily", e.target.value)}
            >
              {FONT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <label className={styles.rowLabel}>Size</label>
            <select
              className={styles.select}
              value={current.fontSize}
              onChange={e => update("fontSize", e.target.value as ExportStyle["fontSize"])}
            >
              {SIZE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </section>

        <button
          className={styles.resetBtn}
          onClick={() => updateExportStyle(DEFAULT_EXPORT_STYLE)}
        >
          Reset to defaults
        </button>
      </aside>

      {/* ── Preview panel ── */}
      <div className={styles.previewPanel}>
        <div className={styles.previewLabel}>Live Preview</div>
        <div className={styles.previewArea}>
          <GamePreview
            key={project.id}
            exportStyle={current}
            showSidebar={true}
          />
        </div>
      </div>
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.colorWrap}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={styles.colorPicker}
        />
        <span className={styles.colorHex}>{value}</span>
      </div>
    </div>
  );
}
