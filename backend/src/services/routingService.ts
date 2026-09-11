import type { Graph, Mode } from '../graph/types.js';
import { loadGraph } from '../graph/loadGraph.js';
import { findPath } from '../graph/astar.js';
import { isWithinCampus } from './campus.js';
import { computeGoogleRoute } from './googleRoutes.js';

export interface RouteQuery {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  travelMode: Mode;
}

export interface RouteResult {
  source: 'own-graph' | 'google';
  distanceMeters: number;
  seconds: number;
  path?: { lat: number; lng: number }[]; // own-graph only
  polyline?: string; // google only
}

export async function computeRoute(query: RouteQuery): Promise<RouteResult | null> {
  const { travelMode, originLat, originLng, destLat, destLng } = query;

  // Walk/bike and any campus-internal trip stay on our own graph — that's
  // where our data beats Google's. Off-campus car/motorcycle needs live
  // traffic we don't have, so it goes to the Google Routes API instead.
  const useOwnGraph =
    travelMode === 'walk' ||
    travelMode === 'bike' ||
    (isWithinCampus(originLat, originLng) && isWithinCampus(destLat, destLng));

  if (useOwnGraph) {
    const graph = loadGraph();
    const originNodeId = nearestNodeId(graph, originLat, originLng);
    const destNodeId = nearestNodeId(graph, destLat, destLng);
    if (!originNodeId || !destNodeId) return null;

    const result = findPath(graph, originNodeId, destNodeId, travelMode);
    if (!result) return null;

    return {
      source: 'own-graph',
      distanceMeters: result.distanceMeters,
      seconds: result.seconds,
      path: result.nodeIds.map((id) => {
        const node = graph.nodes.get(id)!;
        return { lat: node.lat, lng: node.lng };
      }),
    };
  }

  const googleResult = await computeGoogleRoute(originLat, originLng, destLat, destLng, travelMode as 'car' | 'motorcycle');
  return {
    source: 'google',
    distanceMeters: googleResult.distanceMeters,
    seconds: googleResult.seconds,
    polyline: googleResult.polyline,
  };
}

function nearestNodeId(graph: Graph, lat: number, lng: number): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const node of graph.nodes.values()) {
    const d = (node.lat - lat) ** 2 + (node.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }
  return bestId;
}
