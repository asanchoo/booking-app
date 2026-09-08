import crypto from 'crypto';

export function createOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtp(phone, code, secret) {
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

export function otpMatches(storedHash, candidateHash) {
  const left = Buffer.from(String(storedHash || ''), 'utf8');
  const right = Buffer.from(String(candidateHash || ''), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
