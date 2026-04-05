import { Command } from "commander";
import { MindbrainClient } from "../client";
import { loadConfig } from "../config";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

interface GraphNode {
  id: string;
  title: string;
  type: string;
}

interface GraphEdge {
  sourceId: string;
  targetId: string | null;
  type: string;
  label: string;
}

function buildTree(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rootId: string | undefined,
): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, { node: GraphNode; edgeType: string }[]>();

  for (const edge of edges) {
    const parent = edge.sourceId;
    const child = edge.targetId;
    if (!child) continue;
    const childNode = nodeMap.get(child);
    if (!childNode) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push({ node: childNode, edgeType: edge.type });
  }

  const lines: string[] = [];
  const visited = new Set<string>();

  function walk(id: string, prefix: string, isLast: boolean, isRoot: boolean) {
    const node = nodeMap.get(id);
    if (!node) return;
    if (visited.has(id)) {
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${DIM}↻ ${node.title} (cycle)${RESET}`);
      return;
    }
    visited.add(id);

    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const label = `${BOLD}${node.title}${RESET} ${DIM}(${node.id.slice(0, 8)} · ${node.type})${RESET}`;
    lines.push(`${prefix}${connector}${label}`);

    const kids = children.get(id) || [];
    for (let i = 0; i < kids.length; i++) {
      const childPrefix = isRoot
        ? ""
        : prefix + (isLast ? "    " : "│   ");
      walk(kids[i].node.id, childPrefix, i === kids.length - 1, false);
    }
  }

  if (rootId && nodeMap.has(rootId)) {
    walk(rootId, "", true, true);
  } else {
    // Show all root nodes (nodes that are not targets)
    const targetIds = new Set(edges.map((e) => e.targetId).filter(Boolean));
    const roots = nodes.filter((n) => !targetIds.has(n.id));
    if (roots.length === 0 && nodes.length > 0) {
      walk(nodes[0].id, "", true, true);
    } else {
      for (let i = 0; i < roots.length; i++) {
        walk(roots[i].id, "", i === roots.length - 1, true);
      }
    }
  }

  return lines.join("\n");
}

export const graphCommand = new Command("graph")
  .description("Show note graph as ASCII tree")
  .argument("[noteId]", "Root note ID")
  .option("-d, --depth <n>", "Graph depth", "2")
  .action(async (noteId: string | undefined, opts) => {
    const config = await loadConfig();
    if (!config) {
      process.stderr.write("Error: Not initialized. Run `mb init` first.\n");
      process.exit(1);
    }

    try {
      const client = new MindbrainClient(config.apiUrl, config.apiKey);
      const result = await client.graph({
        noteId,
        depth: parseInt(opts.depth),
      });

      const nodes = result.nodes || [];
      const edges = result.edges || [];

      if (nodes.length === 0) {
        console.log(`${DIM}Graph is empty.${RESET}`);
        return;
      }

      console.log(buildTree(nodes, edges, noteId));
      console.log(
        `\n${DIM}${nodes.length} node(s), ${edges.length} edge(s)${RESET}`,
      );
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  });
