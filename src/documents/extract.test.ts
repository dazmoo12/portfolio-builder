import { describe, expect, it } from 'vitest';
import { ageOn, findCandidates, parseAmount } from './extract';

const values = (text: string) =>
  findCandidates({ text }, 'test').map((c) => [c.target.type === 'household' ? c.target.key : c.target.type, c.value]);

describe('document value recognition', () => {
  it('parses German and English amounts', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('3.200')).toBe(3200);
    expect(parseAmount('850')).toBe(850);
  });

  it('finds budget amounts by keyword in running text', () => {
    const text = [
      'Mietvertrag Musterstraße 1',
      'Kaltmiete monatlich: 850,00 €',
      'Kfz-Versicherung Jahresbeitrag 600,00 EUR',
      'Bruttomiete laut Anlage',
    ].join('\n');
    expect(values(text)).toEqual([
      ['exp_housing', 850],
      ['exp_mobility', 50], // car insurance counts as a car cost
    ]);
  });

  it('takes only the net pay from payslips', () => {
    const text = ['Gesamtbrutto 4.800,00 €', 'Lohnsteuer 712,33 €', 'Krankenversicherung 410,40 €', 'Auszahlungsbetrag 3.082,07 €'].join('\n');
    expect(values(text)).toEqual([['inc_salary', 3082.07]]);
  });

  it('recognises dates of birth of the client and children', () => {
    expect(values('Name: Anna Beispiel, geboren am 12.02.1994\nKind: Lena, geb. 03.05.2021')).toEqual([
      ['birthDate', '1994-02-12'],
      ['childBirthYear', 2021],
    ]);
  });

  it('reads label/number rows from spreadsheets', () => {
    const rows = [['Nettogehalt', 3200], ['Kindergeld', 255], ['Strom', 'monatlich', 90], ['Fitnessstudio', 35], ['Urlaub (Rücklage)', 150], ['Auto (Versicherung, Tanken)', 240]];
    const c = findCandidates({ text: '', tables: [{ name: 'Budget', rows }] }, 'x');
    expect(c.map((x) => [(x.target as { key: string }).key, x.value])).toEqual([
      ['inc_salary', 3200],
      ['inc_childBenefit', 255],
      ['exp_utilities', 90],
      ['exp_leisure', 185], // summed
      ['exp_mobility', 240],
    ]);
  });

  it('computes age', () => {
    expect(ageOn('1994-02-12', new Date('2026-10-09'))).toBe(32);
    expect(ageOn('1994-12-12', new Date('2026-10-09'))).toBe(31);
  });
});
