import type { Graph, Mode } from './types.js';
import { haversineMeters } from './geo.js';

export interface PathResult {
  nodeIds: string[];
  distanceMeters: number;
  seconds: number;
}

// Fastest plausible speed across all modes, used to keep the heuristic admissible
// (it must never overestimate true remaining travel time).
const FASTEST_MODE_KMH = 120;

export function findPath(graph: Graph, startId: string, goalId: string, mode: Mode): PathResult | null {
  const start = graph.nodes.get(startId);
  const goal = graph.nodes.get(goalId);
  if (!start || !goal) return null;

  const gScore = new Map<string, number>([[startId, 0]]);
  const cameFrom = new Map<string, string>();
  const cameFromEdgeMeters = new Map<string, number>();

  const heuristic = (nodeId: string) => {
    const node = graph.nodes.get(nodeId)!;
    const meters = haversineMeters(node.lat, node.lng, goal.lat, goal.lng);
    return (meters / 1000 / FASTEST_MODE_KMH) * 3600; // seconds
  };

  // Array-based open set: fine for the small demo/campus graph. Swap for a
  // binary heap once this runs against the full country-wide OSM extract.
  const open: { id: string; f: number }[] = [{ id: startId, f: heuristic(startId) }];
  const visited = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id === goalId) {
      return reconstructPath(cameFrom, cameFromEdgeMeters, gScore, goalId);
    }

    const edges = graph.adjacency.get(current.id) ?? [];
    for (const edge of edges) {
      if (!edge.modes.includes(mode)) continue;
      const speedKmh = edge.speedKmh[mode];
      if (!speedKmh) continue;

      const edgeSeconds = (edge.distanceMeters / 1000 / speedKmh) * 3600;
      const tentativeG = (gScore.get(current.id) ?? Infinity) + edgeSeconds;

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentativeG);
        cameFrom.set(edge.to, current.id);
        cameFromEdgeMeters.set(edge.to, edge.distanceMeters);
        open.push({ id: edge.to, f: tentativeG + heuristic(edge.to) });
      }
    }
  }

  return null;
}

function reconstructPath(
  cameFrom: Map<string, string>,
  edgeMeters: Map<string, number>,
  gScore: Map<string, number>,
  goalId: string
): PathResult {
  const nodeIds = [goalId];
  let distanceMeters = 0;
  let current = goalId;
  while (cameFrom.has(current)) {
    distanceMeters += edgeMeters.get(current) ?? 0;
    current = cameFrom.get(current)!;
    nodeIds.push(current);
  }
  nodeIds.reverse();
  return { nodeIds, distanceMeters, seconds: gScore.get(goalId) ?? 0 };
}
