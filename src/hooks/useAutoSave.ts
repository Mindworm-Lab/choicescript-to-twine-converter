import { useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";

const AUTOSAVE_KEY = "cyoa_project_autosave";
const AUTOSAVE_DB_NAME = "cyoa_autosave_db";
const AUTOSAVE_STORE = "autosaves";
const DEBOUNCE_MS = 1000;

function supportsIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openAutosaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTOSAVE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
        db.createObjectStore(AUTOSAVE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open autosave database."));
  });
}

async function saveAutosaveIndexedDb(payload: string): Promise<boolean> {
  if (!supportsIndexedDb()) return false;

  try {
    const db = await openAutosaveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUTOSAVE_STORE, "readwrite");
      const store = tx.objectStore(AUTOSAVE_STORE);
      store.put(payload, AUTOSAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save autosave."));
      tx.onabort = () => reject(tx.error ?? new Error("Autosave transaction aborted."));
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

async function loadAutosaveIndexedDb(): Promise<string | null> {
  if (!supportsIndexedDb()) return null;

  try {
    const db = await openAutosaveDb();
    const result = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(AUTOSAVE_STORE, "readonly");
      const store = tx.objectStore(AUTOSAVE_STORE);
      const request = store.get(AUTOSAVE_KEY);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Failed to load autosave."));
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export function useAutoSave() {
  const revision = useProjectStore(s => s.revision);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const project = useProjectStore.getState().project;
      const payload = JSON.stringify(project);

      void (async () => {
        const persistedToIndexedDb = await saveAutosaveIndexedDb(payload);
        if (persistedToIndexedDb) return;
        try {
          localStorage.setItem(AUTOSAVE_KEY, payload);
        } catch {
          // ignore storage errors
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revision]);
}

export async function loadAutosave(): Promise<ReturnType<typeof JSON.parse> | null> {
  const indexedPayload = await loadAutosaveIndexedDb();
  if (indexedPayload) {
    try {
      return JSON.parse(indexedPayload);
    } catch {
      // fall through to localStorage
    }
  }

  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    void saveAutosaveIndexedDb(saved);
    return parsed;
  } catch {
    return null;
  }
}
