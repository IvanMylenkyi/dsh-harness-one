export function formatNumber(value, locale = 'en') {
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}

export function formatDate(value, locale = 'en', options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatDateTime(value, locale = 'en') {
  return formatDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(ms, locale = 'en') {
  const value = Math.max(0, Number(ms) || 0);
  const seconds = value / 1000;
  if (seconds < 60) return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds) + ' s';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

export function formatTokens(value, locale = 'en') {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}
