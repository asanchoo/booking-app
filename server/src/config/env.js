const PLACEHOLDER_VALUES = new Set([
  '',
  'your_jwt_secret_here',
  'default_fallback_secret_key_32bytes',
]);

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || PLACEHOLDER_VALUES.has(secret) || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a unique value of at least 32 characters');
  }
  return secret;
}

export function validateEnvironment() {
  getJwtSecret();
  if (!process.env.ADMIN_PASSWORD_HASH) {
    throw new Error('ADMIN_PASSWORD_HASH must be configured');
  }
}
