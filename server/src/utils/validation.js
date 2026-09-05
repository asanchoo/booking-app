// server/src/utils/validation.js

/**
 * Simple validator for admin payloads.
 * Throws an Error with status 400 and a descriptive message when validation fails.
 * schema: { fieldName: { required: true|false, type: 'string'|'integer', regex: /.../ } }
 */
import { HttpError } from './httpError.js';

export function validatePayload(schema, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Ожидается объект с данными');
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    if (value !== undefined && value !== null) {
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
      if (rules.type === 'integer') {
        const num = Number(value);
        if (!Number.isInteger(num) || num < 0) {
          errors.push(`${field} must be a positive integer`);
        }
      }
      if (rules.regex && typeof value === 'string' && !rules.regex.test(value)) {
        errors.push(`${field} has invalid format`);
      }
    }
  }
  if (errors.length) {
    throw new HttpError(400, errors.join(', '));
  }
}
