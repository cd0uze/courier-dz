// test/rateLimit.test.js — per-provider throttle + 429 backoff (#2)
// Run standalone: node --test test/rateLimit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AbstractAdapter } from '../src/adapters/AbstractAdapter.js';

function makeAdapter(rateLimits) {
  return new AbstractAdapter({ baseUrl: 'http://example.test', rateLimits });
}

test('_throttle: allows a burst up to `max` without blocking', async () => {
  const a = makeAdapter([{ max: 3, windowMs: 300 }]);
  const start = Date.now();
  await a._throttle();
  await a._throttle();
  await a._throttle();
  assert.ok(Date.now() - start < 60, 'first `max` calls should be near-instant');
});

test('_throttle: the (max+1)th call waits until the window frees', async () => {
  const a = makeAdapter([{ max: 3, windowMs: 200 }]);
  await a._throttle();
  await a._throttle();
  await a._throttle();
  const start = Date.now();
  await a._throttle(); // must block ~ until the oldest of the 3 ages out
  const waited = Date.now() - start;
  assert.ok(waited >= 150, `4th call should wait for the window, waited ${waited}ms`);
});

test('_throttle: windows are per-adapter (no shared global limiter)', async () => {
  const a = makeAdapter([{ max: 1, windowMs: 500 }]);
  const b = makeAdapter([{ max: 1, windowMs: 500 }]);
  const start = Date.now();
  await a._throttle();
  await b._throttle(); // b has its own window → not blocked by a
  assert.ok(Date.now() - start < 60, 'separate adapters must not share a throttle');
});

test('_retryDelayMs: exponential backoff floor when no Retry-After header', () => {
  const a = makeAdapter([{ max: 5, windowMs: 1000 }]);
  assert.equal(a._retryDelayMs({ headers: {} }, 0), 2000);
  assert.equal(a._retryDelayMs({ headers: {} }, 1), 4000);
  assert.equal(a._retryDelayMs({ headers: {} }, 2), 8000);
});

test('_retryDelayMs: never returns 0 or negative on a bad header (the old bug)', () => {
  const a = makeAdapter([{ max: 5, windowMs: 1000 }]);
  assert.equal(a._retryDelayMs({ headers: { 'retry-after': '0' } }, 0), 2000);
  assert.equal(a._retryDelayMs({ headers: { 'retry-after': '-5' } }, 0), 2000);
  assert.equal(a._retryDelayMs({ headers: { 'retry-after': 'garbage' } }, 0), 2000);
  assert.ok(a._retryDelayMs({ headers: {} }, 0) > 0);
});

test('_retryDelayMs: honors a larger Retry-After header, capped at 60s', () => {
  const a = makeAdapter([{ max: 5, windowMs: 1000 }]);
  assert.equal(a._retryDelayMs({ headers: { 'retry-after': '10' } }, 0), 10_000);
  assert.equal(a._retryDelayMs({ headers: { 'retry-after': '999' } }, 0), 60_000);
});
