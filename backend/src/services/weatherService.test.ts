import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessBikeConditions } from './weatherService.js';

const PLEASANT = { temperatureC: 28, precipitationProbability: 10, windKph: 8 };

test('a mild dry day is bike-friendly', () => {
  assert.equal(assessBikeConditions(PLEASANT).isBikeFriendly, true);
});

test('likely rain outranks otherwise perfect conditions', () => {
  const result = assessBikeConditions({ ...PLEASANT, precipitationProbability: 60 });
  assert.equal(result.isBikeFriendly, false);
  assert.match(result.advice, /rain/i);
});

test('heat and cold each rule out biking', () => {
  assert.equal(assessBikeConditions({ ...PLEASANT, temperatureC: 38 }).isBikeFriendly, false);
  assert.equal(assessBikeConditions({ ...PLEASANT, temperatureC: 5 }).isBikeFriendly, false);
});

test('strong wind rules out biking', () => {
  const result = assessBikeConditions({ ...PLEASANT, windKph: 45 });
  assert.equal(result.isBikeFriendly, false);
  assert.match(result.advice, /wind/i);
});

test('thresholds are inclusive at the boundary', () => {
  assert.equal(assessBikeConditions({ ...PLEASANT, temperatureC: 35 }).isBikeFriendly, false);
  assert.equal(assessBikeConditions({ ...PLEASANT, temperatureC: 10 }).isBikeFriendly, false);
  assert.equal(assessBikeConditions({ ...PLEASANT, windKph: 30 }).isBikeFriendly, false);
  assert.equal(assessBikeConditions({ ...PLEASANT, precipitationProbability: 50 }).isBikeFriendly, false);
});

test('just inside every threshold is still fine', () => {
  const result = assessBikeConditions({ temperatureC: 34, precipitationProbability: 49, windKph: 29 });
  assert.equal(result.isBikeFriendly, true);
});
