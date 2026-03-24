import { MarkerType, type Edge } from "@xyflow/react";
import type { Scene, Block, ChoiceOption, IfBranch } from "../../types";

export interface SceneNodeData extends Record<string, unknown> {
  scene: Scene;
  isActive: boolean;
  isStartup: boolean;
}

// ─── Edge extraction ──────────────────────────────────────────────────────────

interface RawEdge {
  source: string;
  target: string;
}

function collectFromBlocks(
  blocks: Block[],
  sceneId: string,
  filenameToId: Map<string, string>,
  results: RawEdge[],
): void {
  for (const block of blocks) {
    if (block.kind === "goto_scene" && block.sceneName) {
      const targetId = filenameToId.get(block.sceneName);
      if (targetId && targetId !== sceneId) {
        results.push({ source: sceneId, target: targetId });
      }
    } else if (block.kind === "choice") {
      for (const opt of block.options) {
        collectFromOption(opt, sceneId, filenameToId, results);
      }
    } else if (block.kind === "if") {
      for (const branch of block.branches) {
        collectFromBranch(branch, sceneId, filenameToId, results);
      }
    }
  }
}

function collectFromOption(
  opt: ChoiceOption,
  sceneId: string,
  filenameToId: Map<string, string>,
  results: RawEdge[],
): void {
  collectFromBlocks(opt.blocks, sceneId, filenameToId, results);
}

function collectFromBranch(
  branch: IfBranch,
  sceneId: string,
  filenameToId: Map<string, string>,
  results: RawEdge[],
): void {
  collectFromBlocks(branch.blocks, sceneId, filenameToId, results);
}

export function buildEdges(scenes: Scene[]): Edge[] {
  const filenameToId = new Map(scenes.map(s => [s.filename, s.id]));
  const raw: RawEdge[] = [];

  for (const scene of scenes) {
    collectFromBlocks(scene.blocks, scene.id, filenameToId, raw);
  }

  // Dedup by source+target — one logical connection per unique pair.
  const connections = new Set<string>();
  for (const r of raw) {
    connections.add(`${r.source}→${r.target}`);
  }

  // Collapse A→B + B→A bidirectional pairs into a single edge with arrows on
  // both ends. This avoids the visual "double line" where hub scenes like
  // homestead_hub both navigate TO an activity scene and receive a return
  // *goto_scene back — previously rendering as two overlapping curves.
  const processed = new Set<string>();
  const edges: Edge[] = [];

  for (const conn of connections) {
    if (processed.has(conn)) continue;
    const [source, target] = conn.split("→");
    const reverse = `${target}→${source}`;
    processed.add(conn);

    if (connections.has(reverse)) {
      // Bidirectional: one edge, arrows at both ends
      processed.add(reverse);
      edges.push({
        id: conn,
        source,
        target,
        type: "default",
        markerEnd: { type: MarkerType.ArrowClosed },
        markerStart: { type: MarkerType.ArrowClosed },
      });
    } else {
      // Unidirectional: single arrow at target end
      edges.push({
        id: conn,
        source,
        target,
        type: "default",
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }
  }

  return edges;
}

// ─── Auto-layout (BFS from startup) ──────────────────────────────────────────

export function computeAutoLayout(
  scenes: Scene[],
  edges: Edge[],
): Record<string, { x: number; y: number }> {
  const NODE_W = 280;
  const NODE_H = 160;

  const startupId = scenes.find(s => s.filename === "startup")?.id;

  // Build adjacency list (outgoing)
  const adj = new Map<string, string[]>();
  for (const scene of scenes) adj.set(scene.id, []);
  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
  }

  // BFS to assign layers
  const layer = new Map<string, number>();
  const queue: string[] = [];

  const firstId = startupId ?? scenes[0]?.id;
  if (firstId) {
    layer.set(firstId, 0);
    queue.push(firstId);
  }

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const currentLayer = layer.get(id) ?? 0;
    for (const neighbor of adj.get(id) ?? []) {
      if (!layer.has(neighbor)) {
        layer.set(neighbor, currentLayer + 1);
        queue.push(neighbor);
      }
    }
  }

  // Assign disconnected scenes to a final column
  let maxLayer = 0;
  for (const l of layer.values()) maxLayer = Math.max(maxLayer, l);
  for (const scene of scenes) {
    if (!layer.has(scene.id)) layer.set(scene.id, maxLayer + 1);
  }

  // Determine vertical index within each layer
  const layerCounts = new Map<number, number>();
  const positions: Record<string, { x: number; y: number }> = {};

  // Process in BFS order so startup is first in its layer
  const orderedIds = [...queue, ...scenes.map(s => s.id).filter(id => !queue.includes(id))];

  for (const id of orderedIds) {
    const l = layer.get(id) ?? 0;
    const idx = layerCounts.get(l) ?? 0;
    layerCounts.set(l, idx + 1);
    positions[id] = { x: l * NODE_W, y: idx * NODE_H };
  }

  return positions;
}
