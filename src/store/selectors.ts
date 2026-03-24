import { useProjectStore } from "./projectStore";
import type { Scene } from "../types";

export function useActiveScene(): Scene | undefined {
  const { project, activeSceneId } = useProjectStore();
  return project.scenes.find(s => s.id === activeSceneId);
}

export function useVariableNames(): string[] {
  const { project } = useProjectStore();
  return project.variables.map(v => v.name);
}
