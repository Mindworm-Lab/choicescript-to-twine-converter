import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { BlockKind } from "../../types";
import styles from "./BlockEditor.module.css";

const BLOCK_TYPES: { kind: BlockKind; label: string }[] = [
  { kind: "paragraph", label: "Paragraph" },
  { kind: "choice", label: "Choice" },
  { kind: "if", label: "If/Else" },
  { kind: "set", label: "Set Variable" },
  { kind: "label", label: "Label" },
  { kind: "goto", label: "Goto" },
  { kind: "goto_scene", label: "Goto Scene" },
  { kind: "finish", label: "Finish" },
  { kind: "ending", label: "Ending" },
  { kind: "comment", label: "Comment" },
  { kind: "stat_chart", label: "Stat Chart" },
];

interface Props {
  sceneId: string;
  blockPath: number[];
  afterIndex: number;
  label?: string;
}

export default function AddBlockMenu({ sceneId, blockPath, afterIndex, label }: Props) {
  const [open, setOpen] = useState(false);
  const addBlock = useProjectStore(s => s.addBlock);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleAdd(kind: BlockKind) {
    addBlock(sceneId, blockPath, kind, afterIndex);
    setOpen(false);
  }

  return (
    <div className={styles.addBlockMenu} ref={menuRef}>
      <button
        className={`${styles.addBlockBtn} ${label ? styles.addBlockBtnPrimary : ""}`}
        onClick={() => setOpen(!open)}
        title="Add block"
      >
        {label ?? "+"}
      </button>
      {open && (
        <div className={styles.addBlockDropdown}>
          {BLOCK_TYPES.map(({ kind, label: l }) => (
            <button key={kind} onClick={() => handleAdd(kind)}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
