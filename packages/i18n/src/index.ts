import type { Lang } from '@karier/types';
import { LANGS } from '@karier/types';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DICTIONARIES } from './dictionaries';

const STORAGE_KEY = 'kv_lang';
const DEFAULT_LANG: Lang = 'uz-latn';

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (LANGS as readonly string[]).includes(v)) return v as Lang;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

/** Initialize the shared i18next instance. Call once per app at startup. */
export function setupI18n(): typeof i18n {
  if (i18n.isInitialized) return i18n;
  void i18n.use(initReactI18next).init({
    resources: Object.fromEntries(
      LANGS.map((l) => [l, { translation: DICTIONARIES[l] }]),
    ),
    lng: readStoredLang(),
    fallbackLng: DEFAULT_LANG,
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lang);
}

export function currentLang(): Lang {
  return (i18n.language as Lang) ?? DEFAULT_LANG;
}

export { DICTIONARIES } from './dictionaries';
export { formatNumber, formatDecimal } from './format';
export { LANGS };
export type { Lang };
export { useTranslation } from 'react-i18next';
