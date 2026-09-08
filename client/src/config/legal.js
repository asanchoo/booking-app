export const LEGAL_VERSION = '2026-09-08';

export const legalOperator = {
  name: import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim() || 'Владелец заведения BarberShop',
  registrationId: import.meta.env.VITE_LEGAL_OPERATOR_ID?.trim() || '',
  address: import.meta.env.VITE_LEGAL_ADDRESS?.trim() || '',
  contact: import.meta.env.VITE_LEGAL_CONTACT?.trim() || 'через администратора заведения',
};
