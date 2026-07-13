// Centralized number/date formatting. Russian uses a comma decimal separator
// (mirrors the demo `dec()` logic); keep all locale-aware formatting here.

import type { Lang } from '@karier/types';

export function formatNumber(value: number, lang: Lang, fractionDigits = 0): string {
  const locale = lang === 'ru' ? 'ru-RU' : 'uz-UZ';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDecimal(value: number, lang: Lang): string {
  const s = value.toFixed(2);
  return lang === 'ru' ? s.replace('.', ',') : s;
}

// Month names per language. Hardcoded — Intl.DateTimeFormat('uz-UZ') falls
// back to CLDR codes ("M1", "M2", ...) in browsers without Uzbek locale data.
const MONTHS: Record<Lang, string[]> = {
  'uz-latn': [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  ],
  'uz-cyrl': [
    'Январ', 'Феврал', 'Март', 'Апрел', 'Май', 'Июн',
    'Июл', 'Август', 'Сентябр', 'Октябр', 'Ноябр', 'Декабр',
  ],
  ru: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ],
};

/** 1-based month number -> localized month name ('May', 'Май', ...). */
export function monthName(month: number, lang: Lang): string {
  return MONTHS[lang]?.[month - 1] ?? String(month);
}

/** ISO timestamp -> 'DD.MM.YYYY HH:mm' (local time). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
