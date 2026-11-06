// Excel client-data template: a fixed sheet with machine-readable keys in column C,
// so a filled-in file imports exactly – in any language.

import type { Child } from '../engine/types';
import { EXPENSE_KEYS, INCOME_KEYS, type Household } from '../engine/household';
import type { T, TKey } from '../i18n';
import type { AppState } from '../state';
import type { DocTable } from './readers';

export const TEMPLATE_MARKER = 'PORTFOLIO-BUILDER CLIENT DATA v1';

export interface TemplateData {
  name?: string;
  birthDate?: string;
  age?: number;
  children?: Omit<Child, 'id'>[];
  /** Further adults, in template order. */
  adults: { name?: string; age?: number; birthDate?: string }[];
  household: Household;
  count: number;
}

const toGermanDate = (iso?: string) => (iso ? iso.split('-').reverse().join('.') : '');

function parseGermanDate(v: unknown) {
  const m = String(v).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}

export async function downloadTemplate(state: AppState, t: T) {
  const XLSX = await import('xlsx');
  const { client } = state.input;
  const findAmount = (lines: Household['income'], key: string) => lines.find((l) => l.key === key)?.amount ?? '';
  const rows: (string | number)[][] = [
    [TEMPLATE_MARKER, '', ''],
    [t('field_name'), state.input.client.name, 'name'],
    [t('field_birthDate') + ' (dd.mm.yyyy)', toGermanDate(client.birthDate), 'birthDate'],
    [t('field_age'), state.input.client.age, 'age'],
    ...[0, 1, 2].flatMap((i) => {
      const a = client.adults[i];
      return [
        [`${t('field_partnerName')} (${i + 1})`, a?.name ?? '', `adult${i}Name`],
        [`${t('field_partnerBirthDate')} (${i + 1}) (dd.mm.yyyy)`, toGermanDate(a?.birthDate), `adult${i}BirthDate`],
        [`${t('field_partnerAge')} (${i + 1})`, a?.age ?? '', `adult${i}Age`],
      ];
    }),
    [t('children') + ' (dd.mm.yyyy, ...)', client.children.map((c) => toGermanDate(c.birthDate) || c.birthYear).join(', '), 'children'],
    ['', '', ''],
    [t('income') + ' (€)', '', ''],
    ...INCOME_KEYS.map((k) => [t(k as TKey), findAmount(state.household.income, k), k]),
    ['', '', ''],
    [t('expenses') + ' (€)', '', ''],
    ...EXPENSE_KEYS.map((k) => [t(k as TKey), findAmount(state.household.expenses, k), k]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 18, hidden: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kundendaten');
  XLSX.writeFile(wb, `Kundendaten_${(state.input.client.name || 'Vorlage').replace(/\s+/g, '_')}.xlsx`);
}

export function isTemplate(tables: DocTable[] | undefined) {
  return !!tables?.some((tb) => tb.rows[0]?.[0] === TEMPLATE_MARKER);
}

/** Reads a filled-in template; only non-empty values are returned. */
export function parseTemplate(tables: DocTable[]): TemplateData | null {
  const sheet = tables.find((tb) => tb.rows[0]?.[0] === TEMPLATE_MARKER);
  if (!sheet) return null;
  const out: TemplateData = { adults: [], household: { income: [], expenses: [] }, count: 0 };
  for (const row of sheet.rows) {
    const key = String(row[2] ?? '').trim();
    const v = row[1];
    if (!key || v === '' || v === undefined) continue;
    // "partner…" are the keys of templates filled in before several adults were possible
    const adultKey = key.match(/^adult(\d)(Name|BirthDate|Age)$/) ?? key.match(/^partner()(Name|BirthDate|Age)$/);
    if (key === 'name') out.name = String(v);
    else if (key === 'age' && Number(v) > 0) out.age = Number(v);
    else if (adultKey) {
      const a = (out.adults[Number(adultKey[1] ?? 0)] ??= {});
      if (adultKey[2] === 'Name') a.name = String(v);
      else if (adultKey[2] === 'BirthDate') a.birthDate = parseGermanDate(v);
      else if (Number(v) > 0) a.age = Number(v);
    }
    else if (key === 'birthDate') {
      out.birthDate = parseGermanDate(v);
    } else if (key === 'children') {
      out.children = String(v)
        .split(/[,;\s]+/)
        .map((c) => {
          const birthDate = parseGermanDate(c);
          return birthDate ? { birthDate } : { birthYear: Number(c) };
        })
        .filter((c) => c.birthDate || (c.birthYear! > 1900 && c.birthYear! < 2100));
    } else if ((INCOME_KEYS as readonly string[]).includes(key) && Number(v) > 0) {
      out.household.income.push({ id: `t-${key}`, key, amount: Number(v) });
    } else if ((EXPENSE_KEYS as readonly string[]).includes(key) && Number(v) > 0) {
      out.household.expenses.push({ id: `t-${key}`, key, amount: Number(v) });
    } else continue;
    out.count++;
  }
  return out;
}
