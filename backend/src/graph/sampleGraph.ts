import type { Graph, GraphEdge, GraphNode, Mode } from './types.js';
import { haversineMeters } from './geo.js';

// Placeholder fixture graph so the server has something real to route
// against before the OSM extract + campus-overlay import pipeline exists.
// Coordinates are illustrative, not a real campus — replace via loadGraph.ts.
const NODES: GraphNode[] = [
  { id: 'gate', lat: 13.73, lng: 100.78 },
  { id: 'library', lat: 13.7305, lng: 100.781 },
  { id: 'engineering', lat: 13.7312, lng: 100.7822 },
  { id: 'cafeteria', lat: 13.7298, lng: 100.7815 },
  { id: 'dorm', lat: 13.729, lng: 100.783 },
];

type RawEdge = { from: string; to: string; modes: Mode[]; speedKmh: Partial<Record<Mode, number>> };

const RAW_EDGES: RawEdge[] = [
  { from: 'gate', to: 'library', modes: ['walk', 'bike', 'motorcycle', 'car'], speedKmh: { walk: 5, bike: 15, motorcycle: 25, car: 25 } },
  { from: 'library', to: 'engineering', modes: ['walk', 'bike'], speedKmh: { walk: 5, bike: 15 } },
  { from: 'library', to: 'cafeteria', modes: ['walk', 'bike', 'motorcycle', 'car'], speedKmh: { walk: 5, bike: 15, motorcycle: 20, car: 20 } },
  { from: 'cafeteria', to: 'dorm', modes: ['walk', 'bike', 'motorcycle', 'car'], speedKmh: { walk: 5, bike: 15, motorcycle: 25, car: 25 } },
  { from: 'engineering', to: 'dorm', modes: ['walk'], speedKmh: { walk: 5 } },
];

export function buildSampleGraph(): Graph {
  const nodes = new Map(NODES.map((n) => [n.id, n]));
  const adjacency = new Map<string, GraphEdge[]>();

  const addDirected = (from: string, to: string, modes: Mode[], speedKmh: Partial<Record<Mode, number>>) => {
    const a = nodes.get(from)!;
    const b = nodes.get(to)!;
    const edge: GraphEdge = { from, to, distanceMeters: haversineMeters(a.lat, a.lng, b.lat, b.lng), modes, speedKmh };
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(edge);
  };

  // All fixture paths are two-way.
  for (const e of RAW_EDGES) {
    addDirected(e.from, e.to, e.modes, e.speedKmh);
    addDirected(e.to, e.from, e.modes, e.speedKmh);
  }

  return { nodes, adjacency };
}
