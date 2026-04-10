import { useEffect, useState, useCallback, useRef } from 'react';
import { useSSEContext } from '../App';
import { api, type Note, type GraphResult } from '../lib/api';
import { toast } from 'sonner';
import { GraphCanvas, type GraphNode, type GraphEdge, type Theme, darkTheme } from 'reagraph';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XIcon, RefreshCwIcon } from 'lucide-react';

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
  const sse = useSSEContext();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [depth, setDepth] = useState(3);
  const [maxEdges, setMaxEdges] = useState(300);
  const [autoLinkLoading, setAutoLinkLoading] = useState(false);
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

      const validEdges = data.edges
        .filter((e) => e.targetId && nodeIds.has(e.sourceId) && nodeIds.has(e.targetId!));

      const connectionCount = new Map<string, number>();
      for (const e of validEdges) {
        connectionCount.set(e.sourceId, (connectionCount.get(e.sourceId) || 0) + 1);
        connectionCount.set(e.targetId!, (connectionCount.get(e.targetId!) || 0) + 1);
      }

      const connectedNodeIds = new Set(connectionCount.keys());
      const isolatedNodes = data.nodes.filter((n) => !connectedNodeIds.has(n.id));

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

  const handleGraphRefresh = useCallback(() => {
    loadGraph();
  }, []);

  useEffect(() => {
    sse.on('edge:created', handleGraphRefresh);
    sse.on('note:created', handleGraphRefresh);
    sse.on('note:deleted', handleGraphRefresh);
    return () => {
      sse.off('edge:created', handleGraphRefresh);
      sse.off('note:created', handleGraphRefresh);
      sse.off('note:deleted', handleGraphRefresh);
    };
  }, [sse, handleGraphRefresh]);

  async function handleAutoLink() {
    setAutoLinkLoading(true);
    try {
      const result = await api.autoLink();
      toast.success(`Auto-link complete: ${result.created} created, ${result.skipped} skipped`);
      loadGraph();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-link failed');
    }
    setAutoLinkLoading(false);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="p-3 border-b flex items-center gap-4 bg-background z-20 relative">
          <span className="text-sm font-medium">Knowledge Graph</span>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Depth</span>
            <Select value={String(depth)} onValueChange={(v) => setDepth(Number(v))}>
              <SelectTrigger className="w-20 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Max edges</span>
            <Select value={String(maxEdges)} onValueChange={(v) => setMaxEdges(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[100, 200, 300, 500, 1000].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleAutoLink()}
            disabled={autoLinkLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCwIcon className={`h-3.5 w-3.5 ${autoLinkLoading ? 'animate-spin' : ''}`} />
            {autoLinkLoading ? 'Linking...' : 'Auto-link'}
          </Button>

          <div className="flex gap-2 ml-auto flex-wrap">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <Badge key={type} variant="outline" className="gap-1.5 text-[10px]">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {type}
              </Badge>
            ))}
          </div>

          {nodes.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {nodes.length} nodes, {edges.length} edges
            </span>
          )}
        </div>

        {/* Graph canvas */}
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
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[selected.type] ?? DEFAULT_COLOR }}
                  />
                  <Badge variant="outline" className="text-[10px]">{selected.type}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelected(null)}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
              <CardTitle className="text-sm mt-2">{selected.title}</CardTitle>
              {selected.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(selected.updatedAt).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {selected.content.slice(0, 500)}
                {selected.content.length > 500 && '...'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
