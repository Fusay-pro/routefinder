// Rebuilds backend/src/graph/data/campusGraph.json from OpenStreetMap.
//
// Usage:
//   npx tsx scripts/importOsmGraph.ts                 fetch live from Overpass
//   npx tsx scripts/importOsmGraph.ts --input raw.json reuse a cached Overpass response (no network)
//
// Area covered: Thammasat University Rangsit campus plus a ~3km buffer, which
// is as far as it's realistic to route someone on foot or by bike. Farther
// trips fall through to the Google Routes API (see routingService.ts) instead
// of our own graph, so there's no need to import a wider road network.
import { writeFile, readFile } from 'node:fs/promises';
import { haversineMeters } from '../src/graph/geo.js';
import type { CompactGraphData, Mode } from '../src/graph/types.js';

const BBOX = { minLat: 14.0386, minLng: 100.5651, maxLat: 14.1069, maxLng: 100.6452 };

const FOOT_ONLY = new Set(['footway', 'pedestrian', 'steps']);
const SHARED_PATH = new Set(['path', 'cycleway']);
const MAJOR_ROAD = new Set(['primary', 'primary_link', 'trunk', 'trunk_link']);
// Everything else in the query below is a minor road shared by all modes.

const SPEED_KMH: Record<string, Partial<Record<Mode, number>>> = {
  steps: { walk: 2 },
  footway: { walk: 5 },
  pedestrian: { walk: 5 },
  path: { walk: 5, bike: 12 },
  cycleway: { walk: 5, bike: 18 },
  living_street: { walk: 5, bike: 12, motorcycle: 15, car: 15 },
  service: { walk: 5, bike: 12, motorcycle: 20, car: 20 },
  track: { walk: 5, bike: 10, motorcycle: 15, car: 15 },
  residential: { walk: 5, bike: 15, motorcycle: 30, car: 30 },
  unclassified: { walk: 5, bike: 15, motorcycle: 30, car: 30 },
  tertiary: { walk: 5, bike: 15, motorcycle: 40, car: 40 },
  tertiary_link: { walk: 5, bike: 15, motorcycle: 40, car: 40 },
  secondary: { walk: 5, bike: 15, motorcycle: 50, car: 50 },
  secondary_link: { walk: 5, bike: 15, motorcycle: 50, car: 50 },
  primary: { motorcycle: 60, car: 60 },
  primary_link: { motorcycle: 60, car: 60 },
  trunk: { motorcycle: 80, car: 80 },
  trunk_link: { motorcycle: 80, car: 80 },
};

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

async function fetchOverpass(): Promise<OverpassWay[]> {
  const highwayTypes = Object.keys(SPEED_KMH).join('|');
  const query = `[out:json][timeout:180];
way["highway"~"^(${highwayTypes})$"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng});
out body geom;`;

  const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
    method: 'POST',
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass request failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { elements: OverpassWay[] };
  return data.elements;
}

function buildGraph(ways: OverpassWay[]): CompactGraphData {
  const highwayTypes = Object.keys(SPEED_KMH);
  const profiles = highwayTypes.map((highway) => {
    const speedKmh = SPEED_KMH[highway];
    return { travelModes: Object.keys(speedKmh) as Mode[], speedKmh };
  });
  const profileIdxByHighway = new Map(highwayTypes.map((h, i) => [h, i]));

  const nodeIndexByOsmId = new Map<number, number>();
  const nodes: [number, number][] = [];
  const edges: CompactGraphData['edges'] = [];

  const nodeIndex = (osmId: number, lat: number, lng: number): number => {
    let idx = nodeIndexByOsmId.get(osmId);
    if (idx === undefined) {
      idx = nodes.length;
      nodes.push([lat, lng]);
      nodeIndexByOsmId.set(osmId, idx);
    }
    return idx;
  };

  for (const way of ways) {
    const highway = way.tags?.highway;
    const profileIdx = highway ? profileIdxByHighway.get(highway) : undefined;
    if (profileIdx === undefined) continue;

    // Pedestrians and cyclists are conventionally exempt from oneway on
    // roads; only restrict the motorized directions.
    const isMajorOrMinorRoad = !FOOT_ONLY.has(highway!) && !SHARED_PATH.has(highway!);
    const oneway = isMajorOrMinorRoad ? way.tags?.oneway : undefined;

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const a = way.geometry[i];
      const b = way.geometry[i + 1];
      if (!a || !b) continue;

      const fromIdx = nodeIndex(way.nodes[i], a.lat, a.lon);
      const toIdx = nodeIndex(way.nodes[i + 1], b.lat, b.lon);

      const distanceMeters = Math.round(haversineMeters(a.lat, a.lon, b.lat, b.lon) * 10) / 10;
      if (distanceMeters === 0) continue;

      if (oneway === '-1') {
        edges.push([toIdx, fromIdx, distanceMeters, profileIdx]);
      } else if (oneway === 'yes') {
        edges.push([fromIdx, toIdx, distanceMeters, profileIdx]);
      } else {
        edges.push([fromIdx, toIdx, distanceMeters, profileIdx]);
        edges.push([toIdx, fromIdx, distanceMeters, profileIdx]);
      }
    }
  }

  return { profiles, nodes, edges };
}

async function main() {
  const inputFlagIndex = process.argv.indexOf('--input');
  const ways =
    inputFlagIndex !== -1
      ? ((JSON.parse(await readFile(process.argv[inputFlagIndex + 1], 'utf-8')) as { elements: OverpassWay[] }).elements)
      : await fetchOverpass();

  const graph = buildGraph(ways);
  const outPath = new URL('../src/graph/data/campusGraph.json', import.meta.url);
  await writeFile(outPath, JSON.stringify(graph));
  console.log(`Wrote ${graph.nodes.length} nodes, ${graph.edges.length} directed edges from ${ways.length} ways to ${outPath.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
