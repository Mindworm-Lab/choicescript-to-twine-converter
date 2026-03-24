import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import type { GameProject, Scene, Variable, Block, ChoiceOption, IfBranch, ExportStyle } from "../types";

const MAX_HISTORY = 50;

function getNestedBlocks(scene: Scene, blockPath: number[]): Block[] {
  // blockPath describes how to navigate: [blockIndex, optionOrBranchIndex, blockIndex, ...]
  // Returns the blocks array at the path location
  if (blockPath.length === 0) return scene.blocks;

  function navigate(blocks: Block[], path: number[]): Block[] {
    if (path.length === 0) return blocks;
    const [idx, ...rest] = path;
    if (rest.length === 0) return blocks;
    const block = blocks[idx];
    if (!block) return [];
    if (block.kind === "choice" && rest.length >= 1) {
      const [optIdx, ...deeper] = rest;
      const opt = block.options[optIdx];
      if (!opt) return [];
      if (deeper.length === 0) return opt.blocks;
      return navigate(opt.blocks, deeper);
    }
    if (block.kind === "if" && rest.length >= 1) {
      const [branchIdx, ...deeper] = rest;
      const branch = block.branches[branchIdx];
      if (!branch) return [];
      if (deeper.length === 0) return branch.blocks;
      return navigate(branch.blocks, deeper);
    }
    return [];
  }
  return navigate(scene.blocks, blockPath);
}

function defaultProject(): GameProject {
  const startupId = nanoid();
  return {
    id: nanoid(),
    title: "My Story",
    author: "Author",
    scenes: [
      {
        id: startupId,
        filename: "startup",
        title: "Startup",
        blocks: [],
      },
    ],
    variables: [],
  };
}

interface ProjectState {
  project: GameProject;
  activeSceneId: string;
  history: GameProject[];
  historyIndex: number;

  // Project meta
  setProjectMeta: (title: string, author: string) => void;

  // Scenes
  addScene: (filename: string, title: string) => void;
  deleteScene: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  setActiveScene: (sceneId: string) => void;
  updateSceneMeta: (sceneId: string, partial: Partial<Pick<Scene, "filename" | "title">>) => void;

  // Variables
  addVariable: (partial: Partial<Variable>) => void;
  updateVariable: (variableId: string, partial: Partial<Variable>) => void;
  deleteVariable: (variableId: string) => void;

  // Blocks
  addBlock: (sceneId: string, blockPath: number[], kind: Block["kind"], afterIndex: number) => void;
  updateBlock: (sceneId: string, blockPath: number[], partial: Partial<Block>) => void;
  deleteBlock: (sceneId: string, blockPath: number[], index: number) => void;
  moveBlock: (sceneId: string, blockPath: number[], fromIndex: number, toIndex: number) => void;

  // Choice options
  addChoiceOption: (sceneId: string, blockPath: number[]) => void;
  updateChoiceOption: (sceneId: string, blockPath: number[], optionId: string, partial: Partial<ChoiceOption>) => void;
  deleteChoiceOption: (sceneId: string, blockPath: number[], optionId: string) => void;
  moveChoiceOption: (sceneId: string, blockPath: number[], fromIndex: number, toIndex: number) => void;

  // If branches
  addIfBranch: (sceneId: string, blockPath: number[]) => void;
  updateIfBranch: (sceneId: string, blockPath: number[], branchId: string, partial: Partial<IfBranch>) => void;
  deleteIfBranch: (sceneId: string, blockPath: number[], branchId: string) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Persistence
  loadProject: (project: GameProject) => void;

  // Bulk replace (used by code editor parser)
  replaceSceneBlocks: (sceneId: string, blocks: Block[]) => void;
  replaceProjectMeta: (partial: { title?: string; author?: string; variables?: Variable[] }) => void;

  // Node positions (flowchart view) — no history, drag spam must not pollute undo stack
  updateNodePositions: (positions: Record<string, { x: number; y: number }>) => void;

  // Export style — no history, style tweaks must not pollute undo stack
  updateExportStyle: (style: ExportStyle) => void;
}

function pushHistory(state: ProjectState, snapshot: GameProject) {
  // Trim forward history
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(JSON.parse(JSON.stringify(snapshot)));
  if (state.history.length > MAX_HISTORY) {
    state.history.shift();
  } else {
    state.historyIndex = state.history.length - 1;
  }
}

function findScene(project: GameProject, sceneId: string): Scene | undefined {
  return project.scenes.find(s => s.id === sceneId);
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    project: defaultProject(),
    activeSceneId: "",
    history: [],
    historyIndex: -1,

    setProjectMeta: (title, author) => set(state => {
      pushHistory(state, state.project);
      state.project.title = title;
      state.project.author = author;
    }),

    addScene: (filename, title) => set(state => {
      pushHistory(state, state.project);
      const scene: Scene = { id: nanoid(), filename, title, blocks: [] };
      state.project.scenes.push(scene);
      state.activeSceneId = scene.id;
    }),

    deleteScene: (sceneId) => set(state => {
      const idx = state.project.scenes.findIndex(s => s.id === sceneId);
      if (idx === -1 || state.project.scenes[idx].filename === "startup") return;
      pushHistory(state, state.project);
      state.project.scenes.splice(idx, 1);
      if (state.activeSceneId === sceneId) {
        state.activeSceneId = state.project.scenes[0]?.id ?? "";
      }
    }),

    reorderScenes: (fromIndex, toIndex) => set(state => {
      // Don't move startup (index 0) or move to index 0
      if (fromIndex === 0 || toIndex === 0) return;
      pushHistory(state, state.project);
      const [scene] = state.project.scenes.splice(fromIndex, 1);
      state.project.scenes.splice(toIndex, 0, scene);
    }),

    setActiveScene: (sceneId) => set(state => {
      state.activeSceneId = sceneId;
    }),

    updateSceneMeta: (sceneId, partial) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);
      Object.assign(scene, partial);
    }),

    addVariable: (partial) => set(state => {
      pushHistory(state, state.project);
      const variable: Variable = {
        id: nanoid(),
        name: partial.name ?? "newVar",
        type: partial.type ?? "number",
        defaultValue: partial.defaultValue ?? 0,
        description: partial.description ?? "",
      };
      state.project.variables.push(variable);
    }),

    updateVariable: (variableId, partial) => set(state => {
      const v = state.project.variables.find(v => v.id === variableId);
      if (!v) return;
      pushHistory(state, state.project);
      Object.assign(v, partial);
    }),

    deleteVariable: (variableId) => set(state => {
      const idx = state.project.variables.findIndex(v => v.id === variableId);
      if (idx === -1) return;
      pushHistory(state, state.project);
      state.project.variables.splice(idx, 1);
    }),

    addBlock: (sceneId, blockPath, kind, afterIndex) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const blocks = getNestedBlocks(scene, blockPath);

      const newBlock = createBlock(kind);
      blocks.splice(afterIndex + 1, 0, newBlock);
    }),

    updateBlock: (sceneId, blockPath, partial) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      if (blocks[index]) {
        Object.assign(blocks[index], partial);
      }
    }),

    deleteBlock: (sceneId, blockPath, index) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const blocks = getNestedBlocks(scene, blockPath);
      blocks.splice(index, 1);
    }),

    moveBlock: (sceneId, blockPath, fromIndex, toIndex) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const blocks = getNestedBlocks(scene, blockPath);
      const [block] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, block);
    }),

    addChoiceOption: (sceneId, blockPath) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "choice") return;

      const option: ChoiceOption = {
        id: nanoid(),
        text: "New option",
        conditionMode: "simple",
        conditions: [],
        conditionRaw: "",
        visibility: "if",
        blocks: [],
      };
      block.options.push(option);
    }),

    updateChoiceOption: (sceneId, blockPath, optionId, partial) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "choice") return;

      const opt = block.options.find(o => o.id === optionId);
      if (opt) Object.assign(opt, partial);
    }),

    deleteChoiceOption: (sceneId, blockPath, optionId) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "choice") return;

      const optIdx = block.options.findIndex(o => o.id === optionId);
      if (optIdx !== -1) block.options.splice(optIdx, 1);
    }),

    moveChoiceOption: (sceneId, blockPath, fromIndex, toIndex) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "choice") return;

      const [opt] = block.options.splice(fromIndex, 1);
      block.options.splice(toIndex, 0, opt);
    }),

    addIfBranch: (sceneId, blockPath) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "if") return;

      // Insert before *else branch if it exists
      const elseIdx = block.branches.findIndex(b => b.condition === null);
      const branch: IfBranch = {
        id: nanoid(),
        conditionMode: "simple",
        condition: { variable: "", operator: "=", value: "" },
        conditionRaw: "",
        blocks: [],
      };
      if (elseIdx !== -1) {
        block.branches.splice(elseIdx, 0, branch);
      } else {
        block.branches.push(branch);
      }
    }),

    updateIfBranch: (sceneId, blockPath, branchId, partial) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "if") return;

      const branch = block.branches.find(b => b.id === branchId);
      if (branch) Object.assign(branch, partial);
    }),

    deleteIfBranch: (sceneId, blockPath, branchId) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);

      const containerPath = blockPath.slice(0, -1);
      const index = blockPath[blockPath.length - 1];
      const blocks = getNestedBlocks(scene, containerPath);
      const block = blocks[index];
      if (block?.kind !== "if") return;

      const idx = block.branches.findIndex(b => b.id === branchId);
      if (idx !== -1) block.branches.splice(idx, 1);
    }),

    undo: () => set(state => {
      if (state.historyIndex <= 0) return;
      state.historyIndex--;
      state.project = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    }),

    redo: () => set(state => {
      if (state.historyIndex >= state.history.length - 1) return;
      state.historyIndex++;
      state.project = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    }),

    loadProject: (project) => set(state => {
      state.project = project;
      state.activeSceneId = project.scenes[0]?.id ?? "";
      state.history = [];
      state.historyIndex = -1;
    }),

    replaceSceneBlocks: (sceneId, blocks) => set(state => {
      const scene = findScene(state.project, sceneId);
      if (!scene) return;
      pushHistory(state, state.project);
      scene.blocks = blocks;
    }),

    replaceProjectMeta: (partial) => set(state => {
      pushHistory(state, state.project);
      if (partial.title !== undefined) state.project.title = partial.title;
      if (partial.author !== undefined) state.project.author = partial.author;
      if (partial.variables !== undefined) state.project.variables = partial.variables;
    }),

    updateNodePositions: (positions) => set(state => {
      state.project.nodePositions = { ...(state.project.nodePositions ?? {}), ...positions };
    }),

    updateExportStyle: (style) => set(state => {
      state.project.exportStyle = style;
    }),
  }))
);

function createBlock(kind: Block["kind"]): Block {
  const id = nanoid();
  switch (kind) {
    case "paragraph": return { kind, id, text: "" };
    case "choice": return { kind, id, options: [] };
    case "if": return {
      kind, id, branches: [
        { id: nanoid(), conditionMode: "simple", condition: { variable: "", operator: "=", value: "" }, conditionRaw: "", blocks: [] }
      ]
    };
    case "set": return { kind, id, variable: "", operator: "=", value: "" };
    case "label": return { kind, id, name: "" };
    case "goto": return { kind, id, label: "" };
    case "goto_scene": return { kind, id, sceneName: "", label: "" };
    case "finish": return { kind, id };
    case "ending": return { kind, id };
    case "comment": return { kind, id, text: "" };
    case "stat_chart": return { kind, id, title: "", entries: [] };
  }
}

// Initialize activeSceneId after store creation
const initialState = useProjectStore.getState();
if (initialState.project.scenes.length > 0 && !initialState.activeSceneId) {
  useProjectStore.setState({ activeSceneId: initialState.project.scenes[0].id });
}
