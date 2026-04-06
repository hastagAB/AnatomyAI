import { useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { toPng, toSvg } from 'html-to-image';
import { ServiceNode } from './nodes/ServiceNode';
import { GroupNode } from './nodes/GroupNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import { useStore } from '../../store/useStore';

const nodeTypes = {
  custom: ServiceNode,
  group: GroupNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 140;
const GROUP_PADDING = 80;
const GROUP_LABEL_HEIGHT = 50;

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
) {
  const leafNodes = nodes.filter((n) => n.type !== 'group');
  const groupNodes = nodes.filter((n) => n.type === 'group');

  // Scale spacing aggressively for large diagrams
  const count = leafNodes.length;
  const spacingScale = count > 40 ? 2.5 : count > 25 ? 2.0 : count > 15 ? 1.5 : 1.0;
  const nodesep = Math.round(160 * spacingScale);
  const ranksep = Math.round(220 * spacingScale);

  // Build a dagre graph with only leaf nodes
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    edgesep: 80,
    marginx: 60,
    marginy: 60,
    align: 'UL',
  });

  leafNodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  // Collect absolute positions for all leaf nodes
  const absPositions: Record<string, { x: number; y: number }> = {};
  leafNodes.forEach((node) => {
    const pos = g.node(node.id);
    if (pos) {
      absPositions[node.id] = {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      };
    }
  });

  // Compute bounding boxes for group nodes based on their children
  const groupBounds: Record<
    string,
    { x: number; y: number; width: number; height: number }
  > = {};
  groupNodes.forEach((group) => {
    const children = leafNodes.filter((n) => n.parentId === group.id);
    if (children.length === 0) {
      // Empty group — place it after the last leaf node
      const allX = Object.values(absPositions).map((p) => p.x);
      const maxX = allX.length > 0 ? Math.max(...allX) : 0;
      groupBounds[group.id] = {
        x: maxX + NODE_WIDTH + 80,
        y: 0,
        width: 300,
        height: 200,
      };
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    children.forEach((child) => {
      const pos = absPositions[child.id];
      if (!pos) return;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_WIDTH);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
    });

    groupBounds[group.id] = {
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_LABEL_HEIGHT,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_LABEL_HEIGHT,
    };
  });

  // Assemble final positioned nodes — groups first so React Flow renders them behind children
  const layoutedNodes: Node[] = [];

  groupNodes.forEach((node) => {
    const bounds = groupBounds[node.id];
    layoutedNodes.push({
      ...node,
      position: { x: bounds.x, y: bounds.y },
      style: {
        ...(node.style || {}),
        width: bounds.width,
        height: bounds.height,
      },
    });
  });

  leafNodes.forEach((node) => {
    const absPos = absPositions[node.id];
    if (!absPos) {
      layoutedNodes.push(node);
      return;
    }
    // Convert to parent-relative position if child of a group
    if (node.parentId && groupBounds[node.parentId]) {
      const pb = groupBounds[node.parentId];
      layoutedNodes.push({
        ...node,
        position: { x: absPos.x - pb.x, y: absPos.y - pb.y },
      });
    } else {
      layoutedNodes.push({ ...node, position: absPos });
    }
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Export the full diagram at high quality.
 * Uses getNodesBounds + getViewportForBounds so the ENTIRE diagram is captured,
 * not just the visible viewport.
 */
export async function exportDiagram(
  format: 'png' | 'svg',
  pixelRatio: number = 4,
): Promise<void> {
  const el = document.querySelector('.react-flow__viewport') as HTMLElement;
  if (!el) return;

  const nodeEls = document.querySelectorAll('.react-flow__node');
  if (nodeEls.length === 0) return;

  // Measure full bounds of all nodes
  const flowEl = document.querySelector('.react-flow') as HTMLElement;
  const rfNodes = Array.from(nodeEls);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Get transform of viewport
  const vpStyle = window.getComputedStyle(el);
  const matrix = new DOMMatrix(vpStyle.transform);

  rfNodes.forEach((n) => {
    const rect = n.getBoundingClientRect();
    // Convert from screen coords back to flow coords
    const x = (rect.left - flowEl.getBoundingClientRect().left - matrix.e) / matrix.a;
    const y = (rect.top - flowEl.getBoundingClientRect().top - matrix.f) / matrix.d;
    const w = rect.width / matrix.a;
    const h = rect.height / matrix.d;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  const padding = 80;
  const boundsWidth = maxX - minX + padding * 2;
  const boundsHeight = maxY - minY + padding * 2;

  // Render image width/height
  const imageWidth = boundsWidth * pixelRatio;
  const imageHeight = boundsHeight * pixelRatio;

  const fn = format === 'png' ? toPng : toSvg;
  const dataUrl = await fn(el, {
    backgroundColor: '#030712',
    width: boundsWidth,
    height: boundsHeight,
    pixelRatio,
    style: {
      width: `${boundsWidth}px`,
      height: `${boundsHeight}px`,
      transform: `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`,
    },
  });

  const link = document.createElement('a');
  const diagramTitle = useStore.getState().currentDiagram?.title || 'anatomy-diagram';
  const safeName = diagramTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase();
  link.download = `${safeName}.${format}`;
  link.href = dataUrl;
  link.click();
}

function DiagramCanvasInner() {
  const { currentDiagram, diagramLayoutDirection, diagramLayoutKey } =
    useStore();
  const { fitView } = useReactFlow();

  // Track which layout key was last applied to avoid re-layout on every render
  const appliedLayoutRef = useRef<string | null>(null);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!currentDiagram) return { initialNodes: [], initialEdges: [] };

    const rawNodes: Node[] = currentDiagram.nodes.map((n) => ({
      id: n.id,
      type: n.type === 'group' ? 'group' : 'custom',
      position: n.position || { x: 0, y: 0 },
      data: {
        label: n.label,
        description: n.description,
        technology: n.technology,
        nodeType: n.type,
      },
      ...(n.parent ? { parentId: n.parent } : {}),
      // Allow dragging for all non-group nodes
      draggable: n.type !== 'group',
    }));

    const rawEdges: Edge[] = currentDiagram.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'animated',
      label: e.label,
      data: { description: e.description },
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } =
      getLayoutedElements(rawNodes, rawEdges, diagramLayoutDirection);

    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDiagram, diagramLayoutDirection, diagramLayoutKey]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Only reset layout when diagram data or explicit relayout request changes
  // This preserves drag positions during normal interaction
  useEffect(() => {
    const layoutId = `${currentDiagram?.diagram_type}-${diagramLayoutDirection}-${diagramLayoutKey}`;
    if (appliedLayoutRef.current === layoutId) return;
    appliedLayoutRef.current = layoutId;

    setNodes(initialNodes);
    setEdges(initialEdges);
    window.requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1.2, duration: 300 }));
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView, currentDiagram, diagramLayoutDirection, diagramLayoutKey]);

  if (!currentDiagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Select a diagram type to generate</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2}
        className="bg-gray-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.03)"
        />
        <Controls
          className="!bg-gray-900/80 !border-white/10 !rounded-xl !shadow-2xl [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-gray-400 [&>button:hover]:!text-white [&>button:hover]:!bg-white/5"
        />
        <MiniMap
          className="!bg-gray-900/80 !border-white/10 !rounded-xl"
          maskColor="rgba(0,0,0,0.7)"
          nodeColor="#6366f1"
        />
      </ReactFlow>

      {/* Title overlay */}
      <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2">
        <h2 className="text-sm font-semibold text-white">{currentDiagram.title}</h2>
        {currentDiagram.description && (
          <p className="text-xs text-gray-400 mt-0.5">{currentDiagram.description}</p>
        )}
      </div>
    </div>
  );
}

export function DiagramCanvas() {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner />
    </ReactFlowProvider>
  );
}
