import test from 'node:test';
import assert from 'node:assert/strict';
import { hasExplicitLegalConsent, LEGAL_DOCUMENT_VERSION } from '../src/services/legalConsent.js';

test('legal consent accepts only an explicit boolean true', () => {
  assert.equal(hasExplicitLegalConsent(true), true);
  for (const value of [false, 'true', 1, null, undefined, {}]) {
    assert.equal(hasExplicitLegalConsent(value), false);
  }
});

test('legal document version is a stable date identifier', () => {
  assert.match(LEGAL_DOCUMENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});
