import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type Note, type GraphResult } from '../lib/api';
import { GraphCanvas, type GraphNode, type GraphEdge, type Theme, darkTheme } from 'reagraph';

const TYPE_COLORS: Record<string, string> = {
  user: '#4ade80',
  feedback: '#fbbf24',
  project: '#60a5fa',
  reference: '#c084fc',
  codebase: '#22d3ee',
  debug: '#f87171',
};

const DEFAULT_COLOR = '#6b7280';

const graphTheme: Theme = {
  ...darkTheme,
  canvas: { background: '#0f0f17' },
  node: {
    ...darkTheme.node,
    fill: '#6b7280',
    activeFill: '#ffffff',
    opacity: 1,
    selectedOpacity: 1,
    inactiveOpacity: 0.2,
    label: {
      ...darkTheme.node.label,
      color: '#a1a1aa',
      activeColor: '#ffffff',
      stroke: '#0f0f17',
    },
  },
  edge: {
    ...darkTheme.edge,
    fill: '#ffffff',
    activeFill: '#60a5fa',
    opacity: 0.04,
    selectedOpacity: 0.3,
    inactiveOpacity: 0.01,
  },
  lasso: {
    ...darkTheme.lasso,
  },
};

export function GraphView() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [depth, setDepth] = useState(3);
  const [maxEdges, setMaxEdges] = useState(300);
  const notesRef = useRef<Note[]>([]);

  useEffect(() => {
    loadGraph();
  }, [depth, maxEdges]);

  async function loadGraph() {
    setLoading(true);
    try {
      const data: GraphResult = await api.getGraph(depth);
      notesRef.current = data.nodes;
      const nodeIds = new Set(data.nodes.map((n) => n.id));

      // Filter valid edges and limit count
      const validEdges = data.edges
        .filter((e) => e.targetId && nodeIds.has(e.sourceId) && nodeIds.has(e.targetId!));

      // Count connections per node
      const connectionCount = new Map<string, number>();
      for (const e of validEdges) {
        connectionCount.set(e.sourceId, (connectionCount.get(e.sourceId) || 0) + 1);
        connectionCount.set(e.targetId!, (connectionCount.get(e.targetId!) || 0) + 1);
      }

      // Only keep nodes that have connections (reduces noise)
      const connectedNodeIds = new Set(connectionCount.keys());
      const isolatedNodes = data.nodes.filter((n) => !connectedNodeIds.has(n.id));

      // Keep all connected nodes + a sample of isolated ones
      const nodesToShow = [
        ...data.nodes.filter((n) => connectedNodeIds.has(n.id)),
        ...isolatedNodes.slice(0, 30),
      ];
      const showIds = new Set(nodesToShow.map((n) => n.id));

      const graphNodes: GraphNode[] = nodesToShow.map((n) => ({
        id: n.id,
        label: n.title.length > 50 ? n.title.slice(0, 47) + '...' : n.title,
        fill: TYPE_COLORS[n.type] ?? DEFAULT_COLOR,
        size: Math.max(3, 2 + (connectionCount.get(n.id) || 0) * 3),
      }));

      // Limit edges to avoid hairball
      const graphEdges: GraphEdge[] = validEdges
        .filter((e) => showIds.has(e.sourceId) && showIds.has(e.targetId!))
        .slice(0, maxEdges)
        .map((e) => ({
          id: e.id,
          source: e.sourceId,
          target: e.targetId!,
        }));

      setNodes(graphNodes);
      setEdges(graphEdges);
    } catch (err) {
      console.error('Failed to load graph:', err);
    }
    setLoading(false);
  }

  const handleNodeClick = useCallback((node: GraphNode) => {
    const note = notesRef.current.find((n) => n.id === node.id);
    setSelected(note ?? null);
  }, []);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="p-3 border-b flex items-center gap-4 bg-background z-20 relative">
          <span className="text-sm font-medium">Knowledge Graph</span>

          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted-foreground">Depth:</label>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm bg-background"
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted-foreground">Max edges:</label>
            <select
              value={maxEdges}
              onChange={(e) => setMaxEdges(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm bg-background"
            >
              {[100, 200, 300, 500, 1000].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 ml-auto">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-muted-foreground">{type}</span>
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {nodes.length > 0 ? `${nodes.length} nodes, ${edges.length} edges` : ''}
          </span>
        </div>

        {/* Graph */}
        <div className="flex-1 relative" style={{ background: '#0f0f17' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0f0f17]">
              <span className="text-sm text-zinc-400">Loading graph...</span>
            </div>
          )}
          {nodes.length > 0 && (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              theme={graphTheme}
              layoutType="forceDirected2d"
              cameraMode="rotate"
              sizingType="none"
              labelType="all"
              draggable
              edgeArrowPosition="none"
              onNodeClick={handleNodeClick}
              layoutOverrides={{
                nodeStrength: -30,
                linkDistance: 80,
              }}
            />
          )}
        </div>
      </div>

      {/* Selected node detail */}
      {selected && (
        <div className="w-80 border-l overflow-auto p-4 bg-background">
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-muted-foreground hover:text-foreground mb-3 block"
          >
            close
          </button>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[selected.type] ?? DEFAULT_COLOR }}
            />
            <span className="text-xs text-muted-foreground">{selected.type}</span>
          </div>
          <h3 className="font-semibold mb-2">{selected.title}</h3>
          {selected.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-3">
              {selected.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-muted rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground mb-3">
            {new Date(selected.updatedAt).toLocaleDateString()}
          </div>
          <div className="text-sm whitespace-pre-wrap text-muted-foreground">
            {selected.content.slice(0, 500)}
            {selected.content.length > 500 && '...'}
          </div>
        </div>
      )}
    </div>
  );
}
