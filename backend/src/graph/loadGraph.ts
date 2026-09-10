import type { Graph } from './types.js';
import { buildSampleGraph } from './sampleGraph.js';

let cachedGraph: Graph | null = null;

// TODO: replace with the real OSM extract + campus-overlay import pipeline.
// Each backend instance calls this once at boot and keeps the result in memory.
export function loadGraph(): Graph {
  if (!cachedGraph) {
    cachedGraph = buildSampleGraph();
  }
  return cachedGraph;
}
