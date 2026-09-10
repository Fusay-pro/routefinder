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
  modes: Mode[];
  speedKmh: Partial<Record<Mode, number>>;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
}
