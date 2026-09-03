import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual } from '../src/routes/integrations.js';

test('integration secrets require a non-empty exact constant-time match', () => {
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual('wrong', 'expected'), false);
  assert.equal(safeEqual('expected-extra', 'expected'), false);
  assert.equal(safeEqual('expected', 'expected'), true);
});
