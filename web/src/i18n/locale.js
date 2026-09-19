export const LOCALE_STORAGE_KEY = 'workflow-one:locale:v1';
export const SUPPORTED_LOCALES = ['zh-CN', 'en'];

function normalizeLocale(value) {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN';
  return null;
}

export function resolveLocale({ storage, dshLocale, languages, language } = {}) {
  const explicit = normalizeLocale(language) || normalizeLocale(storage);
  if (explicit) return explicit;
  const host = normalizeLocale(dshLocale);
  if (host) return host;
  for (const candidate of languages || []) {
    const resolved = normalizeLocale(candidate);
    if (resolved) return resolved;
  }
  return 'en';
}

export function readStoredLocale() {
  try { return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) || null; } catch { return null; }
}

export function writeStoredLocale(locale) {
  try { globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* storage is optional */ }
}

export function browserLanguages() {
  return globalThis.navigator?.languages || [globalThis.navigator?.language].filter(Boolean);
}
