import { readFileSync } from 'node:fs';
import type { CompactGraphData, Graph, GraphEdge, GraphNode } from './types.js';

let cachedGraph: Graph | null = null;

// Loads the OSM-derived walk/bike/campus-road network (Thammasat Rangsit +
// ~3km) built by scripts/importOsmGraph.ts. Each backend instance parses
// this once at boot and keeps the result in memory.
export function loadGraph(): Graph {
  if (!cachedGraph) {
    const dataPath = new URL('./data/campusGraph.json', import.meta.url);
    const data = JSON.parse(readFileSync(dataPath, 'utf-8')) as CompactGraphData;

    const nodes = new Map<string, GraphNode>(
      data.nodes.map(([lat, lng], idx) => [String(idx), { id: String(idx), lat, lng }])
    );

    const adjacency = new Map<string, GraphEdge[]>();
    for (const [fromIdx, toIdx, distanceMeters, profileIdx] of data.edges) {
      const from = String(fromIdx);
      const to = String(toIdx);
      const profile = data.profiles[profileIdx];
      const edge: GraphEdge = { from, to, distanceMeters, travelModes: profile.travelModes, speedKmh: profile.speedKmh };
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from)!.push(edge);
    }

    cachedGraph = { nodes, adjacency };
  }
  return cachedGraph;
}
