import { readFileSync } from 'node:fs';
import type { CompactGraphData, Graph, GraphEdge, GraphNode, Mode } from './types.js';

let cachedGraph: Graph | null = null;

// Running uses the pedestrian network, so rather than re-import the whole graph
// to add a `run` profile, every walkable edge is marked runnable at load time.
// A* still costs edges by time, so runners get the same paths, faster ETAs.
// Split this out into a real importer profile if running ever needs different
// edges than walking (stairs, say, or a track surface preference).
const RUN_SPEED_KMH = 9;

function withRun(profile: CompactGraphData['profiles'][number]): {
  travelModes: Mode[];
  speedKmh: Partial<Record<Mode, number>>;
} {
  if (!profile.travelModes.includes('walk')) return profile;
  return {
    travelModes: [...profile.travelModes, 'run'],
    speedKmh: { ...profile.speedKmh, run: RUN_SPEED_KMH },
  };
}

// Loads the OSM-derived walk/bike/campus-road network (Thammasat Rangsit +
// ~3km) built by scripts/importOsmGraph.ts. Each backend instance parses
// this once at boot and keeps the result in memory.
export function loadGraph(): Graph {
  if (!cachedGraph) {
    const dataPath = new URL('./data/campusGraph.json', import.meta.url);
    const data = JSON.parse(readFileSync(dataPath, 'utf-8')) as CompactGraphData;

    const nodes = new Map<string, GraphNode>(
      data.nodes.map(([lat, lng, elevationMeters], idx) => [
        String(idx),
        { id: String(idx), lat, lng, elevationMeters },
      ])
    );

    // Derived once per profile, not once per edge — there are ~65k edges and a
    // handful of profiles, and every edge sharing a profile shares the object.
    const profiles = data.profiles.map(withRun);

    const adjacency = new Map<string, GraphEdge[]>();
    for (const [fromIdx, toIdx, distanceMeters, profileIdx] of data.edges) {
      const from = String(fromIdx);
      const to = String(toIdx);
      const profile = profiles[profileIdx];
      const edge: GraphEdge = { from, to, distanceMeters, travelModes: profile.travelModes, speedKmh: profile.speedKmh };
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from)!.push(edge);
    }

    cachedGraph = { nodes, adjacency };
  }
  return cachedGraph;
}
