import { test } from 'node:test';
import assert from 'node:assert/strict';
import { co2SavedGrams, CAR_GRAMS_PER_KM } from './co2Service.js';

test('a kilometre on foot avoids a kilometre of car emissions', () => {
  assert.equal(co2SavedGrams('walk', 1000), CAR_GRAMS_PER_KM);
  assert.equal(co2SavedGrams('run', 1000), CAR_GRAMS_PER_KM);
  assert.equal(co2SavedGrams('bike', 1000), CAR_GRAMS_PER_KM);
});

test('savings scale with distance', () => {
  assert.equal(co2SavedGrams('walk', 2500), Math.round(2.5 * CAR_GRAMS_PER_KM));
});

test('motorised modes save nothing, and never go negative', () => {
  assert.equal(co2SavedGrams('car', 5000), 0);
  assert.equal(co2SavedGrams('motorcycle', 5000), 0);
});

test('a zero-distance or nonsensical trip saves nothing', () => {
  assert.equal(co2SavedGrams('walk', 0), 0);
  assert.equal(co2SavedGrams('walk', -100), 0);
});
