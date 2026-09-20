import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './messages/en.js';
import zhCN from './messages/zh-CN.js';
import { legacyEnglish, legacyChinese } from './legacy.js';
import { browserLanguages, readStoredLocale, resolveLocale, writeStoredLocale } from './locale.js';
import { formatDate, formatDateTime, formatDuration, formatNumber, formatTokens } from './format.js';

export const LOCALES = { en, 'zh-CN': zhCN };
const LEGACY_MESSAGES = { en: legacyEnglish, 'zh-CN': legacyChinese };
const I18nContext = createContext(null);

function interpolate(template, variables = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => variables[name] == null ? `{${name}}` : String(variables[name]));
}

function pluralize(template, variables, locale) {
  const match = String(template).match(/^\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*}$/);
  if (!match) return null;
  const count = Number(variables[match[1]] || 0);
  const category = new Intl.PluralRules(locale).select(count);
  return (category === 'one' ? match[2] : match[3]).replaceAll('#', new Intl.NumberFormat(locale).format(count));
}

export function translateText(value, locale = 'en') {
  const input = String(value ?? '');
  return LEGACY_MESSAGES[locale]?.[input] ?? input;
}

export function createTranslator(locale) {
  const dictionary = LOCALES[locale] || LOCALES.en;
  return (key, variables = {}) => {
    // Stable-key callers must never silently enter the legacy text lookup.
    // The compatibility API remains explicit through translateText()/tx().
    const raw = dictionary.messages[key] ?? key;
    return interpolate(pluralize(raw, variables, locale) ?? raw, variables);
  };
}

function DocumentLocale({ locale }) {
  const { t } = useI18n();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('app.documentTitle');
  }, [locale, t]);
  return null;
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => resolveLocale({
    storage: readStoredLocale(),
    // The host may expose its effective language through the document boundary;
    // no private DSH runtime API is required.
    dshLocale: globalThis.document?.documentElement?.dataset?.dshLocale || null,
    languages: browserLanguages(),
  }));
  const setLocale = useCallback((next) => {
    const resolved = resolveLocale({ language: next });
    setLocaleState(resolved);
    writeStoredLocale(resolved);
  }, []);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    translateText: (text) => translateText(text, locale),
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(Number(value) || 0),
    formatDate: (value, options) => formatDate(value, locale, options),
    formatDateTime: (value) => formatDateTime(value, locale),
    formatDuration: (value) => formatDuration(value, locale),
    formatTokens: (value) => formatTokens(value, locale),
  }), [locale, setLocale, t]);
  return React.createElement(
    I18nContext.Provider,
    { value },
    React.createElement(DocumentLocale, { locale }),
    children,
  );
}

export function useI18n() {
  return useContext(I18nContext) || { locale: 'en', setLocale: () => {}, t: createTranslator('en'), translateText: (value) => value };
}

// Compatibility-only API for external legacy callers. First-party UI must use
// useI18n().t with a stable key; the scanner rejects tx()/translateText() in
// first-party source so this lookup can never become a new UI fallback.
export const tx = (value, locale = 'en') => translateText(value, locale);

export { formatDate, formatDateTime, formatDuration, formatNumber, formatTokens } from './format.js';
export { resolveLocale, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from './locale.js';
