/**
 * Canonical phone normalizer.
 * Extracts digits and converts KZ/RU 11-digit numbers (starting with 8 or 7)
 * to 11-digit format starting with 7 (e.g. 77059998877).
 * If 10 digits provided, prefixes with 7.
 *
 * @param {string|number} rawPhone
 * @returns {string} Normalized 11-digit phone string (e.g. "77059998877")
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 11) {
    if (digits.startsWith('8') || digits.startsWith('7')) {
      return '7' + digits.slice(1);
    }
  } else if (digits.length === 10) {
    return '7' + digits;
  }

  // Fallback: take last 10 digits if longer
  if (digits.length > 10) {
    return '7' + digits.slice(-10);
  }

  return digits;
}
