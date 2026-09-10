import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath } from './astar.js';
import type { Graph, GraphEdge, GraphNode } from './types.js';

function graphWith(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  const adjacency = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge);
  }
  return { nodes: new Map(nodes.map((n) => [n.id, n])), adjacency };
}

test('finds the shortest-time path and ignores edges not allowed for the mode', () => {
  const nodes: GraphNode[] = [
    { id: 'a', lat: 0, lng: 0 },
    { id: 'b', lat: 0, lng: 0.001 },
    { id: 'c', lat: 0.001, lng: 0.001 },
  ];

  const edges: GraphEdge[] = [
    { from: 'a', to: 'b', distanceMeters: 100, modes: ['walk'], speedKmh: { walk: 5 } },
    { from: 'b', to: 'c', distanceMeters: 100, modes: ['walk'], speedKmh: { walk: 5 } },
    { from: 'a', to: 'c', distanceMeters: 500, modes: ['car'], speedKmh: { car: 30 } },
  ];

  const result = findPath(graphWith(nodes, edges), 'a', 'c', 'walk');

  assert.ok(result);
  assert.deepEqual(result!.nodeIds, ['a', 'b', 'c']);
  assert.equal(result!.distanceMeters, 200);
});

test('picks the faster route by time, not the shorter one by distance', () => {
  const nodes: GraphNode[] = [
    { id: 'a', lat: 0, lng: 0 },
    { id: 'b', lat: 0, lng: 0.001 },
    { id: 'c', lat: 0, lng: 0.002 },
  ];

  const edges: GraphEdge[] = [
    // Direct but slow (e.g. a footpath).
    { from: 'a', to: 'c', distanceMeters: 150, modes: ['bike'], speedKmh: { bike: 5 } },
    // Longer but much faster overall (e.g. a paved cycle route).
    { from: 'a', to: 'b', distanceMeters: 100, modes: ['bike'], speedKmh: { bike: 30 } },
    { from: 'b', to: 'c', distanceMeters: 100, modes: ['bike'], speedKmh: { bike: 30 } },
  ];

  const result = findPath(graphWith(nodes, edges), 'a', 'c', 'bike');

  assert.ok(result);
  assert.deepEqual(result!.nodeIds, ['a', 'b', 'c']);
});

test('returns null when no path exists for the requested mode', () => {
  const nodes: GraphNode[] = [
    { id: 'a', lat: 0, lng: 0 },
    { id: 'b', lat: 0, lng: 0.001 },
  ];
  const edges: GraphEdge[] = [{ from: 'a', to: 'b', distanceMeters: 100, modes: ['car'], speedKmh: { car: 30 } }];

  const result = findPath(graphWith(nodes, edges), 'a', 'b', 'walk');

  assert.equal(result, null);
});
