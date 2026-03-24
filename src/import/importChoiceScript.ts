import { nanoid } from "nanoid";
import { parseSceneText } from "../codegen/parseScene";
import type { GameProject, Scene, Variable } from "../types";

interface TextFile {
  name: string;
  text: string;
}

export interface ImportChoiceScriptResult {
  project: GameProject;
  warnings: string[];
  report: {
    sourceTextFileCount: number;
    importedSceneCount: number;
    importedVariableCount: number;
    usedSceneList: boolean;
    missingSceneListEntries: number;
    extraSceneFilesAppended: number;
  };
}

function normalizeSceneName(fileName: string): string {
  return fileName.replace(/\.txt$/i, "").trim();
}

function humanizeSceneTitle(fileName: string): string {
  return normalizeSceneName(fileName)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase()) || "Scene";
}

function parseSceneList(startupText: string): string[] {
  const result: string[] = [];
  const lines = startupText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!/^\*scene_list\b/i.test(trimmed)) continue;

    const baseIndent = raw.length - raw.trimStart().length;
    for (let j = i + 1; j < lines.length; j++) {
      const nextRaw = lines[j];
      const nextTrimmed = nextRaw.trim();

      if (!nextTrimmed) continue;

      const indent = nextRaw.length - nextRaw.trimStart().length;
      if (indent <= baseIndent) break;
      if (nextTrimmed.startsWith("*") || nextTrimmed.startsWith("$") || nextTrimmed.startsWith("//")) continue;

      const sceneName = nextTrimmed.split(/\s+/)[0]?.trim();
      if (!sceneName || !/^[a-z0-9_-]+$/i.test(sceneName)) continue;
      if (sceneName && !result.includes(sceneName)) {
        result.push(sceneName);
      }
    }

    break;
  }

  return result;
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function cloneVariables(variables: Variable[] | undefined): Variable[] {
  if (!variables) return [];
  return variables.map(v => ({
    id: v.id || nanoid(),
    name: v.name,
    type: v.type,
    defaultValue: v.defaultValue,
    description: v.description ?? "",
  }));
}

export function importChoiceScriptFromFiles(files: TextFile[]): ImportChoiceScriptResult {
  const warnings: string[] = [];

  const txtFiles = files.filter(f => /\.txt$/i.test(f.name));
  const byScene = new Map<string, TextFile>();

  for (const file of txtFiles) {
    const scene = normalizeSceneName(file.name).toLowerCase();
    if (!scene) continue;
    byScene.set(scene, file);
  }

  const startupFile = byScene.get("startup");
  if (!startupFile) {
    throw new Error("Could not find startup.txt in selected folder.");
  }

  const startupParsed = parseSceneText(startupFile.text, "startup");
  const startupMeta = startupParsed.meta;
  const orderedFromSceneList = parseSceneList(startupFile.text).map(s => s.toLowerCase());
  let missingSceneListEntries = 0;

  const availableScenes = [...byScene.keys()].filter(name => name !== "startup").sort((a, b) => a.localeCompare(b));
  const orderedSceneNames = dedupe([
    "startup",
    ...orderedFromSceneList,
    ...availableScenes,
  ]);

  for (const sceneName of orderedFromSceneList) {
    if (!byScene.has(sceneName)) {
      missingSceneListEntries++;
      warnings.push(`Scene listed in *scene_list not found: ${sceneName}.txt`);
    }
  }

  const scenes: Scene[] = [];

  for (const sceneName of orderedSceneNames) {
    const file = byScene.get(sceneName);
    if (!file) continue;

    const parsed = parseSceneText(file.text, sceneName);
    scenes.push({
      id: nanoid(),
      filename: sceneName,
      title: humanizeSceneTitle(sceneName),
      blocks: parsed.blocks,
    });
  }

  if (scenes.length === 0) {
    scenes.push({ id: nanoid(), filename: "startup", title: "Startup", blocks: [] });
    warnings.push("No parseable scene files found. Created empty startup scene.");
  }

  const referenced = new Set(orderedFromSceneList);
  const extraFiles = availableScenes.filter(s => !referenced.has(s));
  if (extraFiles.length > 0 && orderedFromSceneList.length > 0) {
    warnings.push(`Found ${extraFiles.length} scene file(s) not listed in *scene_list; appended automatically.`);
  }

  const project: GameProject = {
    id: nanoid(),
    title: startupMeta?.title?.trim() || "Imported ChoiceScript Story",
    author: startupMeta?.author?.trim() || "Unknown",
    variables: cloneVariables(startupMeta?.variables),
    scenes,
  };

  return {
    project,
    warnings,
    report: {
      sourceTextFileCount: txtFiles.length,
      importedSceneCount: scenes.length,
      importedVariableCount: project.variables.length,
      usedSceneList: orderedFromSceneList.length > 0,
      missingSceneListEntries,
      extraSceneFilesAppended: orderedFromSceneList.length > 0 ? extraFiles.length : 0,
    },
  };
}
