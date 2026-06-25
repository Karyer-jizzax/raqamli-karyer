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
