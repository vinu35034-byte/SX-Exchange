/**
 * formatters.js
 *
 * All number / currency / date / percent formatting tied to the active i18n language.
 * Uses the browser's built-in Intl API — no extra translation files needed.
 *
 * WHAT THIS SOLVES
 * ─────────────────
 * • Numbers    → 1,234.56  (EN) / 1.234,56  (DE) / 1 234,56  (FR) / 1,234.56 (JA/KO/HI)
 * • Prices     → $1,234.56 (EN) / 1.234,56 $ (DE) / 1 234,56 $ (FR) etc.
 * • Percents   → +12.34%   (EN) / +12,34 %  (FR) / +12,34 %  (DE) etc.
 * • Dates      → Mar 1, 2026 (EN) / 1 mars 2026 (FR) / 1. März 2026 (DE) etc.
 * • Compact    → 1.2K / 1.2M / 1.2B  (locale-aware)
 *
 * WHAT CANNOT BE AUTO-TRANSLATED
 * ───────────────────────────────
 * Dynamic text from APIs (coin names, notification messages, descriptions) cannot be
 * auto-translated on the frontend. Options:
 *   1. Backend stores multi-language fields: { name: { en: "...", fr: "..." } }
 *   2. Use a translation API (Google Translate / DeepL) at runtime — costs money per call
 *   3. Leave as-is — most crypto data (BTC, ETH, prices, symbols) is universal
 *
 * USAGE
 * ─────
 * import { useFormatters } from '../utils/formatters';
 *
 * function MyComponent() {
 *   const { formatPrice, formatPercent, formatDate, formatNumber, formatCompact } = useFormatters();
 *   return <p>{formatPrice(1234.56)}</p>;  // → "$1,234.56" in EN, "1.234,56 $" in DE
 * }
 */

import { useTranslation } from 'react-i18next';

/** Map i18next language codes → BCP 47 locale tags used by Intl */
const LOCALE_MAP = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
};

/** Resolve language code to a valid Intl locale string */
function toLocale(lang) {
  return LOCALE_MAP[lang] || LOCALE_MAP[lang?.split('-')[0]] || 'en-US';
}

// ─────────────────────────────────────────────────────────────
// Pure functions — call these when you already have the lang code
// (useful outside React components, e.g. in API response handlers)
// ─────────────────────────────────────────────────────────────

/**
 * Format a crypto price value.
 * Automatically picks decimal places based on magnitude.
 * @param {number|string} value
 * @param {string} lang - i18next language code
 * @param {string} currency - ISO 4217 code, default 'USD'
 */
export function formatPrice(value, lang = 'en', currency = 'USD') {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';

  const locale = toLocale(lang);
  let fractionDigits = 2;
  if (n > 0 && n < 0.01) fractionDigits = 6;
  else if (n < 1)         fractionDigits = 4;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/**
 * Format a plain number (no currency symbol).
 * @param {number|string} value
 * @param {string} lang
 * @param {number} decimals - default 2
 */
export function formatNumber(value, lang = 'en', decimals = 2) {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat(toLocale(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Format a percentage change value.
 * Always shows sign (+ or -).
 * @param {number|string} value  - e.g. 12.34 means 12.34%
 * @param {string} lang
 */
export function formatPercent(value, lang = 'en') {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + new Intl.NumberFormat(toLocale(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + '%';
}

/**
 * Format large numbers in compact form (1K, 1.2M, 3.4B).
 * @param {number|string} value
 * @param {string} lang
 */
export function formatCompact(value, lang = 'en') {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat(toLocale(lang), {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Format a date/timestamp.
 * @param {string|number|Date} value
 * @param {string} lang
 * @param {'short'|'medium'|'long'|'full'} style - default 'medium'
 */
export function formatDate(value, lang = 'en', style = 'medium') {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';

  const locale = toLocale(lang);
  const options = {
    short:  { year: 'numeric', month: 'numeric',  day: 'numeric' },
    medium: { year: 'numeric', month: 'short',    day: 'numeric' },
    long:   { year: 'numeric', month: 'long',     day: 'numeric' },
    full:   { year: 'numeric', month: 'long',     day: 'numeric', hour: '2-digit', minute: '2-digit' },
  };
  return new Intl.DateTimeFormat(locale, options[style] || options.medium).format(d);
}

/**
 * Format a relative time (e.g. "2 hours ago", "in 3 days").
 * @param {string|number|Date} value
 * @param {string} lang
 */
export function formatRelativeTime(value, lang = 'en') {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';

  const locale = toLocale(lang);
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr  = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60)  return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60)  return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr)  < 24)  return rtf.format(diffHr,  'hour');
  return rtf.format(diffDay, 'day');
}

// ─────────────────────────────────────────────────────────────
// React hook — auto-reads current language from i18n context
// ─────────────────────────────────────────────────────────────

/**
 * Hook that returns all formatters pre-bound to the current active language.
 *
 * @example
 * const { formatPrice, formatPercent, formatDate } = useFormatters();
 * formatPrice(42000.5)        // → "$42,000.50"  (EN)  |  "42.000,50 $"  (DE)
 * formatPercent(-3.14)        // → "-3.14%"       (EN)  |  "-3,14 %"      (FR)
 * formatDate('2026-03-01')    // → "Mar 1, 2026"  (EN)  |  "1 mars 2026"  (FR)
 */
export function useFormatters() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  return {
    formatPrice:        (v, currency) => formatPrice(v, lang, currency),
    formatNumber:       (v, decimals) => formatNumber(v, lang, decimals),
    formatPercent:      (v)           => formatPercent(v, lang),
    formatCompact:      (v)           => formatCompact(v, lang),
    formatDate:         (v, style)    => formatDate(v, lang, style),
    formatRelativeTime: (v)           => formatRelativeTime(v, lang),
    lang,
    locale: toLocale(lang),
  };
}
