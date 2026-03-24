import { useCallback, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useProjectStore } from "../../store/projectStore";
import { useActiveScene } from "../../store/selectors";
import SceneNode from "./SceneNode";
import BlockList from "../BlockEditor/BlockList";
import AddBlockMenu from "../BlockEditor/AddBlockMenu";
import { buildEdges, computeAutoLayout, type SceneFlowNode } from "./useFlowchartData";
import styles from "./FlowchartView.module.css";

const NODE_TYPES: NodeTypes = { sceneNode: SceneNode };

const DEFAULT_EDGE_OPTIONS = {
  type: "default" as const,
  style: { strokeWidth: 1.5 },
};

interface FlowchartViewProps {
  className?: string;
  onOpenEditor: () => void;
}

function FlowchartInner({ onOpenEditor }: { onOpenEditor: () => void }) {
  const project = useProjectStore(s => s.project);
  const setActiveScene = useProjectStore(s => s.setActiveScene);
  const updateNodePositions = useProjectStore(s => s.updateNodePositions);
  const addScene = useProjectStore(s => s.addScene);
  const updateSceneMeta = useProjectStore(s => s.updateSceneMeta);
  const activeScene = useActiveScene();
  const { screenToFlowPosition } = useReactFlow();

  const scenes = project.scenes;
  const savedPositions = project.nodePositions ?? {};

  const [addingScene, setAddingScene] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const filenameInputRef = useRef<HTMLInputElement>(null);

  const derivedEdges = useMemo(() => buildEdges(scenes), [scenes]);
  const autoLayout = useMemo(
    () => computeAutoLayout(scenes, derivedEdges),
    [scenes, derivedEdges],
  );

  const initialNodes: SceneFlowNode[] = useMemo(
    () =>
      scenes.map(scene => ({
        id: scene.id,
        type: "sceneNode",
        position: savedPositions[scene.id] ?? autoLayout[scene.id] ?? { x: 0, y: 0 },
        data: {
          scene,
          isActive: scene.id === (activeScene?.id ?? ""),
          isStartup: scene.filename === "startup",
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(derivedEdges);

  const activeSceneId = activeScene?.id ?? "";
  const nodesWithActive = useMemo(
    () => nodes.map(n => ({ ...n, data: { ...n.data, isActive: n.id === activeSceneId } })),
    [nodes, activeSceneId],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => { setActiveScene(node.id); },
    [setActiveScene],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => { setActiveScene(node.id); onOpenEditor(); },
    [setActiveScene, onOpenEditor],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => { updateNodePositions({ [node.id]: node.position }); },
    [updateNodePositions],
  );

  function handleAddScene() {
    const fn = newFilename.trim();
    if (!fn) { filenameInputRef.current?.focus(); return; }
    const title = newTitle.trim() || fn;
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    addScene(fn, title);
    setTimeout(() => {
      const newScene = useProjectStore.getState().project.scenes.find(s => s.filename === fn);
      if (newScene) {
        updateNodePositions({ [newScene.id]: pos });
        setNodes(nds => [
          ...nds,
          { id: newScene.id, type: "sceneNode", position: pos,
            data: { scene: newScene, isActive: false, isStartup: false } },
        ]);
        setActiveScene(newScene.id);
      }
    }, 0);
    setNewFilename("");
    setNewTitle("");
    setAddingScene(false);
  }

  return (
    <div className={styles.outerLayout}>
      {/* ── Canvas ── */}
      <div className={styles.canvas}>
        <div className={styles.floatingBar}>
          {addingScene ? (
            <div className={styles.addForm}>
              <input
                ref={filenameInputRef}
                className={styles.addInput}
                placeholder="filename (e.g. cave)"
                value={newFilename}
                onChange={e => setNewFilename(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddScene()}
                autoFocus
              />
              <input
                className={styles.addInput}
                placeholder="display title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddScene()}
              />
              <button className={styles.addConfirm} onClick={handleAddScene}>Add</button>
              <button className={styles.addCancel} onClick={() => { setAddingScene(false); setNewFilename(""); setNewTitle(""); }}>✕</button>
            </div>
          ) : (
            <button className={styles.newSceneBtn} onClick={() => setAddingScene(true)}>
              ＋ New Scene
            </button>
          )}
        </div>

        <ReactFlow
          nodes={nodesWithActive}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={NODE_TYPES}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={null}
          onNodesDelete={() => setNodes(n => n)}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--chrome-border)" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor="var(--chrome-raised)"
            maskColor="rgba(0,0,0,0.4)"
            style={{ background: "var(--chrome-surface)" }}
          />
        </ReactFlow>
      </div>

      {/* ── Scene editor panel ── */}
      <aside className={`${styles.inspector} ${activeScene ? styles.inspectorOpen : ""}`}>
        {activeScene ? (
          <>
            <div className={styles.inspectorHeader}>
              <div className={styles.inspectorTitleRow}>
                {editingTitle ? (
                  <input
                    className={styles.inspectorTitleEdit}
                    defaultValue={activeScene.title}
                    autoFocus
                    onBlur={e => { updateSceneMeta(activeScene.id, { title: e.target.value }); setEditingTitle(false); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") { updateSceneMeta(activeScene.id, { title: (e.target as HTMLInputElement).value }); setEditingTitle(false); }
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                  />
                ) : (
                  <h2 className={styles.inspectorTitle} onClick={() => setEditingTitle(true)} title="Click to rename">
                    {activeScene.title || activeScene.filename}
                  </h2>
                )}
                <span className={styles.inspectorFilename}>{activeScene.filename}.txt</span>
              </div>
              <button className={styles.openEditorBtn} onClick={() => { setActiveScene(activeScene.id); onOpenEditor(); }} title="Switch to full editor">
                ⤢ Full editor
              </button>
            </div>

            <div className={styles.inspectorBody}>
              <BlockList
                sceneId={activeScene.id}
                blockPath={[]}
                blocks={activeScene.blocks}
              />
              <AddBlockMenu
                sceneId={activeScene.id}
                blockPath={[]}
                afterIndex={activeScene.blocks.length - 1}
                label="+ Add Block"
              />
            </div>
          </>
        ) : (
          <div className={styles.inspectorPlaceholder}>
            Click a scene to edit it here
          </div>
        )}
      </aside>
    </div>
  );
}

export default function FlowchartView({ className, onOpenEditor }: FlowchartViewProps) {
  return (
    <div className={`${styles.outerWrapper} ${className ?? ""}`}>
      <ReactFlowProvider>
        <FlowchartInner onOpenEditor={onOpenEditor} />
      </ReactFlowProvider>
    </div>
  );
}
