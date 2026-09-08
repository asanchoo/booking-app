import test from 'node:test';
import assert from 'node:assert/strict';
import { createOtpCode, hashOtp, otpMatches } from '../src/services/otpSecurity.js';

test('password reset codes are six digits and stored as a one-way hash', () => {
  const code = createOtpCode();
  const stored = hashOtp('+77001234567', code, 'test-secret-with-enough-entropy');

  assert.match(code, /^\d{6}$/);
  assert.notEqual(stored, code);
  assert.equal(otpMatches(stored, hashOtp('+77001234567', code, 'test-secret-with-enough-entropy')), true);
  assert.equal(otpMatches(stored, hashOtp('+77001234567', '000000', 'test-secret-with-enough-entropy')), false);
  assert.equal(otpMatches(stored, hashOtp('+77007654321', code, 'test-secret-with-enough-entropy')), false);
});
