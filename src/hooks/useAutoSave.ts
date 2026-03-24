import { useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";

const AUTOSAVE_KEY = "cyoa_project_autosave";
const DEBOUNCE_MS = 1000;

export function useAutoSave() {
  const revision = useProjectStore(s => s.revision);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const project = useProjectStore.getState().project;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
      } catch {
        // ignore storage errors
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revision]);
}

export function loadAutosave(): ReturnType<typeof JSON.parse> | null {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
