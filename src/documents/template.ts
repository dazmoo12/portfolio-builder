// Excel client-data template: a fixed sheet with machine-readable keys in column C,
// so a filled-in file imports exactly – in any language.

import { EXPENSE_KEYS, INCOME_KEYS, type Household } from '../engine/household';
import type { T, TKey } from '../i18n';
import type { AppState } from '../state';
import type { DocTable } from './readers';

export const TEMPLATE_MARKER = 'PORTFOLIO-BUILDER CLIENT DATA v1';

export interface TemplateData {
  name?: string;
  birthDate?: string;
  age?: number;
  childrenBirthYears?: number[];
  household: Household;
  count: number;
}

export async function downloadTemplate(state: AppState, t: T) {
  const XLSX = await import('xlsx');
  const findAmount = (lines: Household['income'], key: string) => lines.find((l) => l.key === key)?.amount ?? '';
  const rows: (string | number)[][] = [
    [TEMPLATE_MARKER, '', ''],
    [t('field_name'), state.input.client.name, 'name'],
    [t('field_birthDate') + ' (dd.mm.yyyy)', '', 'birthDate'],
    [t('field_age'), state.input.client.age, 'age'],
    [t('children'), state.input.client.childrenBirthYears.join(', '), 'children'],
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
  const out: TemplateData = { household: { income: [], expenses: [] }, count: 0 };
  for (const row of sheet.rows) {
    const key = String(row[2] ?? '').trim();
    const v = row[1];
    if (!key || v === '' || v === undefined) continue;
    if (key === 'name') out.name = String(v);
    else if (key === 'age' && Number(v) > 0) out.age = Number(v);
    else if (key === 'birthDate') {
      const m = String(v).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) out.birthDate = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    } else if (key === 'children') {
      out.childrenBirthYears = String(v)
        .split(/[,;\s]+/)
        .map(Number)
        .filter((y) => y > 1900 && y < 2100);
    } else if ((INCOME_KEYS as readonly string[]).includes(key) && Number(v) > 0) {
      out.household.income.push({ id: `t-${key}`, key, amount: Number(v) });
    } else if ((EXPENSE_KEYS as readonly string[]).includes(key) && Number(v) > 0) {
      out.household.expenses.push({ id: `t-${key}`, key, amount: Number(v) });
    } else continue;
    out.count++;
  }
  return out;
}
