import { useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";

const AUTOSAVE_KEY = "cyoa_project_autosave";
const DEBOUNCE_MS = 1000;

export function useAutoSave() {
  const project = useProjectStore(s => s.project);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
      } catch {
        // ignore storage errors
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [project]);
}

export function loadAutosave(): ReturnType<typeof JSON.parse> | null {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
