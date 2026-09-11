export type Mode = 'walk' | 'bike' | 'motorcycle' | 'car';

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  distanceMeters: number;
  travelModes: Mode[];
  speedKmh: Partial<Record<Mode, number>>;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
}

// On-disk format written by scripts/importOsmGraph.ts and read by
// loadGraph.ts: nodes/edges reference each other by array index, and edges
// share a small table of (travelModes, speedKmh) profiles keyed by highway
// type instead of repeating them on every edge.
export interface CompactGraphData {
  profiles: { travelModes: Mode[]; speedKmh: Partial<Record<Mode, number>> }[];
  nodes: [lat: number, lng: number][];
  edges: [fromIdx: number, toIdx: number, distanceMeters: number, profileIdx: number][];
}
