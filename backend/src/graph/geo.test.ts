import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elevationDelta } from './geo.js';

test('sums climb and descent separately', () => {
  const result = elevationDelta([
    { elevationMeters: 10 },
    { elevationMeters: 25 },
    { elevationMeters: 20 },
    { elevationMeters: 30 },
  ]);
  assert.deepEqual(result, { gainMeters: 25, lossMeters: 5 });
});

test('a flat path has neither gain nor loss', () => {
  const result = elevationDelta([{ elevationMeters: 12 }, { elevationMeters: 12 }, { elevationMeters: 12 }]);
  assert.deepEqual(result, { gainMeters: 0, lossMeters: 0 });
});

test('a net-flat out-and-back still reports the climb it contains', () => {
  const result = elevationDelta([{ elevationMeters: 0 }, { elevationMeters: 30 }, { elevationMeters: 0 }]);
  assert.deepEqual(result, { gainMeters: 30, lossMeters: 30 });
});

test('a graph without elevation reports zeroes rather than NaN', () => {
  const result = elevationDelta([{}, {}, {}]);
  assert.deepEqual(result, { gainMeters: 0, lossMeters: 0 });
});

test('segments missing an endpoint elevation are skipped, not guessed', () => {
  const result = elevationDelta([{ elevationMeters: 10 }, {}, { elevationMeters: 40 }, { elevationMeters: 50 }]);
  assert.deepEqual(result, { gainMeters: 10, lossMeters: 0 });
});

test('a single-node path has no segments to measure', () => {
  assert.deepEqual(elevationDelta([{ elevationMeters: 10 }]), { gainMeters: 0, lossMeters: 0 });
  assert.deepEqual(elevationDelta([]), { gainMeters: 0, lossMeters: 0 });
});
