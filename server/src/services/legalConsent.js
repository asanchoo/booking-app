export const LEGAL_DOCUMENT_VERSION = '2026-09-08';

export function hasExplicitLegalConsent(value) {
  return value === true;
}

export function legalConsentTimestamp() {
  return new Date().toISOString();
}
