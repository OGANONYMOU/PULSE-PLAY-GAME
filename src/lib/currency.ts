export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP' | 'GHS' | 'KES' | 'ZAR' | 'CAD' | 'AUD';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  NGN: '₦', USD: '$', EUR: '€', GBP: '£',
  GHS: '₵', KES: 'KSh', ZAR: 'R', CAD: 'CA$', AUD: 'A$',
};

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string }> = [
  { code: 'NGN', label: 'Nigerian Naira (₦)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'GHS', label: 'Ghanaian Cedi (₵)' },
  { code: 'KES', label: 'Kenyan Shilling (KSh)' },
  { code: 'ZAR', label: 'South African Rand (R)' },
  { code: 'CAD', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
];

// Timezone → currency mapping
const TZ_MAP: Array<[string, CurrencyCode]> = [
  ['Africa/Lagos',        'NGN'],
  ['Africa/Abuja',        'NGN'],
  ['Africa/Accra',        'GHS'],
  ['Africa/Nairobi',      'KES'],
  ['Africa/Johannesburg', 'ZAR'],
  ['Europe/London',       'GBP'],
  ['America/Toronto',     'CAD'],
  ['America/Vancouver',   'CAD'],
  ['Australia/',          'AUD'],
];

// Language/region → currency mapping
const LOCALE_MAP: Record<string, CurrencyCode> = {
  NG: 'NGN', US: 'USD', GB: 'GBP',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
  NL: 'EUR', BE: 'EUR', PT: 'EUR', AT: 'EUR',
  GH: 'GHS', KE: 'KES', ZA: 'ZAR',
  CA: 'CAD', AU: 'AUD',
};

export function detectCurrency(): CurrencyCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    for (const [prefix, code] of TZ_MAP) {
      if (tz.startsWith(prefix)) return code;
    }
    if (tz.startsWith('America/')) return 'USD';
    if (tz.startsWith('Europe/'))  return 'EUR';
    const lang  = navigator.language ?? '';
    const country = lang.split('-')[1]?.toUpperCase() ?? '';
    return LOCALE_MAP[country] ?? 'NGN';
  } catch {
    return 'NGN';
  }
}
