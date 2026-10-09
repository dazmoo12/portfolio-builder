import type { Lang } from '../engine/types';
import { de } from './de';
import { en, type Dict } from './en';
import { pt } from './pt';

// To add a language: create xx.ts implementing Dict, register it here and in the Lang type.
export const dictionaries: Record<Lang, Dict> = { de, en, pt };

export const languages: { code: Lang; label: string; locale: string }[] = [
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'pt', label: 'Português', locale: 'pt-PT' },
];

export type TKey = keyof Dict;
export type T = (key: TKey, vars?: Record<string, string>) => string;

export function makeT(lang: Lang): T {
  const d = dictionaries[lang];
  return (key, vars) => {
    let s = d[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
}

export function localeOf(lang: Lang) {
  return languages.find((l) => l.code === lang)!.locale;
}

export function makeFormat(lang: Lang) {
  const locale = localeOf(lang);
  const eur = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eurShort = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  return {
    eur: (n: number) => eur.format(n),
    eurShort: (n: number) => `${eurShort.format(n)} €`,
    pct: (n: number) => pct.format(n),
    num: (n: number) => n.toLocaleString(locale),
  };
}
export type Format = ReturnType<typeof makeFormat>;
