// Finds values in document text that can fill the client form: income/expense amounts
// by keyword, dates of birth, children. Every hit is a suggestion – the advisor applies it.

import type { DocContent } from './readers';

export type CandidateTarget =
  | { type: 'household'; side: 'income' | 'expenses'; key: string }
  | { type: 'birthDate' }
  | { type: 'childBirthYear' }
  | { type: 'name' };

export interface Candidate {
  id: string;
  target: CandidateTarget;
  /** Monthly € amount, birth date (ISO), birth year or name. */
  value: number | string;
  /** Text the value was found in. */
  context: string;
  source: string;
}

// Keywords (lower case) per budget category – German first, plus English/Portuguese.
const KEYWORDS: { side: 'income' | 'expenses'; key: string; words: string[] }[] = [
  { side: 'income', key: 'inc_salary', words: ['nettogehalt', 'netto-gehalt', 'nettobezug', 'nettoverdienst', 'auszahlungsbetrag', 'net salary', 'net pay', 'salário líquido'] },
  { side: 'income', key: 'inc_partner', words: ['einkommen partner', 'netto partner', 'partner netto', 'partner income'] },
  { side: 'income', key: 'inc_childBenefit', words: ['kindergeld', 'child benefit', 'abono de família'] },
  { side: 'income', key: 'inc_other', words: ['mieteinnahme', 'nebeneinkünfte', 'nebeneinkommen', 'sonstige einnahmen', 'other income'] },
  { side: 'expenses', key: 'exp_housing', words: ['kaltmiete', 'warmmiete', 'miete', 'hausgeld', 'baufinanzierung', 'rent', 'mortgage', 'renda'] },
  { side: 'expenses', key: 'exp_utilities', words: ['nebenkosten', 'strom', 'gas', 'heizung', 'wasser', 'energie', 'utilities', 'electricity'] },
  // mobility before insurance: "Auto (Versicherung, Tanken)" is a mobility cost
  { side: 'expenses', key: 'exp_mobility', words: ['kfz', ' auto ', 'auto:', 'leasing', 'tanken', 'benzin', 'deutschlandticket', 'öpnv', 'fahrkarte', ' car ', 'fuel'] },
  { side: 'expenses', key: 'exp_insurance', words: ['versicherung', 'versicherungsbeitrag', 'prämie', 'insurance', 'seguro'] },
  { side: 'expenses', key: 'exp_living', words: ['lebensmittel', 'lebenshaltung', 'haushaltsgeld', 'groceries', 'alimentação'] },
  { side: 'expenses', key: 'exp_communication', words: ['mobilfunk', 'handy', 'telefon', 'internet', 'dsl', 'rundfunk', 'streaming', 'phone'] },
  { side: 'expenses', key: 'exp_leisure', words: ['freizeit', 'urlaub', 'fitness', 'verein', 'hobby', 'holiday', 'leisure', 'férias'] },
  { side: 'expenses', key: 'exp_savings', words: ['sparplan', 'sparvertrag', 'bausparen', 'bausparvertrag', 'riester', 'rürup', 'savings plan'] },
  { side: 'expenses', key: 'exp_loans', words: ['ratenkredit', 'kredit', 'darlehen', 'tilgung', 'loan', 'empréstimo'] },
];

// 1.234,56 € | € 1.234 | 1234,00 EUR | 1,234.56 EUR
const AMOUNT = /(?:€|eur(?:o)?)\s*(\d{1,3}(?:[.\s']\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)|(\d{1,3}(?:[.\s']\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o)?\b)/gi;
const DATE = /(\d{1,2})[./](\d{1,2})[./](\d{4})|(\d{4})-(\d{2})-(\d{2})/;
const BIRTH_WORDS = ['geboren', 'geb.', 'geburtsdatum', 'date of birth', 'born', 'data de nascimento'];
const CHILD_WORDS = ['kind', 'sohn', 'tochter', 'child', 'filho', 'filha'];

export function parseAmount(raw: string): number {
  let s = raw.replace(/[\s']/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // German: 1.234,56
  else if (/\.\d{1,2}$/.test(s) && s.indexOf(',') >= 0) s = s.replace(/,/g, ''); // English: 1,234.56
  else s = s.replace(/[.,](?=\d{3}\b)/g, ''); // thousands only
  return Number(s);
}

/** Converts yearly/quarterly amounts to monthly. */
function toMonthly(amount: number, line: string): number {
  const l = line.toLowerCase();
  if (/(jährlich|jahresbeitrag|p\.\s?a\.|pro jahr|per year|annual|anual)/.test(l) && !/(halbjährlich|vierteljährlich)/.test(l)) return amount / 12;
  if (/(halbjährlich|semi-annual)/.test(l)) return amount / 6;
  if (/(vierteljährlich|quartal|quarterly)/.test(l)) return amount / 3;
  return amount;
}

function parseDate(m: RegExpMatchArray): string | null {
  const [d, mo, y] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) || dt.getFullYear() < 1900 || dt.getFullYear() > 2100 ? null : iso;
}

// payslip deductions – not part of the household budget
const SKIP = ['rentenversicherung', 'arbeitslosenversicherung', 'pflegeversicherung', 'sozialversicherung', 'lohnsteuer', 'solidaritätszuschlag', 'kirchensteuer'];

function matchCategory(text: string) {
  const l = ` ${text.toLowerCase()} `;
  if (SKIP.some((w) => l.includes(w))) return undefined;
  if (/\bbrutto\b|gross/.test(l) && !/netto|net\b/.test(l)) return undefined; // gross salary is not budget income
  return KEYWORDS.find((k) => k.words.some((w) => l.includes(w)));
}

let seq = 0;
const cid = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

export function findCandidates(content: DocContent, source: string): Candidate[] {
  const out: Candidate[] = [];
  const push = (c: Omit<Candidate, 'id' | 'source'>) => {
    const dup = out.some((o) => JSON.stringify(o.target) === JSON.stringify(c.target) && o.value === c.value);
    if (!dup) out.push({ ...c, id: cid(), source });
  };

  // 1) tables (Excel/CSV): a label cell followed by a number in the same row;
  //    several rows of the same category (e.g. gym + holidays) are summed up
  const sums = new Map<string, { side: 'income' | 'expenses'; key: string; value: number; context: string[] }>();
  for (const table of content.tables ?? []) {
    for (const row of table.rows) {
      const label = row.find((c) => typeof c === 'string' && c.trim().length > 2) as string | undefined;
      const num = row.find((c) => typeof c === 'number' && c > 0) as number | undefined;
      if (!label || num === undefined) continue;
      const cat = matchCategory(label);
      if (!cat) continue;
      const e = sums.get(cat.key) ?? { side: cat.side, key: cat.key, value: 0, context: [] };
      e.value += toMonthly(num, label);
      e.context.push(`${label} ${num}`);
      sums.set(cat.key, e);
    }
  }
  for (const e of sums.values())
    push({ target: { type: 'household', side: e.side, key: e.key }, value: round2(e.value), context: e.context.join(' + ') });

  // 2) running text: line by line
  const lines = content.text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  // on payslips every other amount is a deduction – only the net pay counts for the budget
  const payslip = /lohnsteuer|gesamtbrutto|auszahlungsbetrag/i.test(content.text);
  for (const line of lines) {
    const lower = line.toLowerCase();
    const date = line.match(DATE);
    if (date) {
      const iso = parseDate(date);
      if (iso && BIRTH_WORDS.some((w) => lower.includes(w))) {
        if (CHILD_WORDS.some((w) => new RegExp(`\\b${w}`).test(lower))) push({ target: { type: 'childBirthYear' }, value: Number(iso.slice(0, 4)), context: line });
        else push({ target: { type: 'birthDate' }, value: iso, context: line });
      }
    }
    if (content.tables) continue; // tables were handled above
    const cat = matchCategory(line);
    if (!cat || (payslip && cat.key !== 'inc_salary')) continue;
    for (const m of line.matchAll(AMOUNT)) {
      const value = parseAmount(m[1] ?? m[2]);
      if (value > 0 && value < 100_000) push({ target: { type: 'household', side: cat.side, key: cat.key }, value: round2(toMonthly(value, line)), context: line });
    }
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Age in full years on a given date. */
export function ageOn(birthIso: string, on = new Date()): number {
  const b = new Date(birthIso);
  let age = on.getFullYear() - b.getFullYear();
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) age--;
  return age;
}
