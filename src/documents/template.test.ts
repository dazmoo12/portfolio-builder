import { describe, expect, it } from 'vitest';
import { defaultState } from '../state';
import { applyTemplate } from './apply';
import { TEMPLATE_MARKER, isTemplate, parseTemplate } from './template';

describe('client data template', () => {
  const rows = [
    [TEMPLATE_MARKER, '', ''],
    ['Name', 'Max Muster', 'name'],
    ['Geburtsdatum (dd.mm.yyyy)', '01.06.1990', 'birthDate'],
    ['Zweite Person – Name', 'Eva Muster', 'partnerName'],
    ['Zweite Person – Geburtsdatum', '15.03.1988', 'partnerBirthDate'],
    ['Kinder', '2018, 2021', 'children'],
    ['Nettogehalt', 2900, 'inc_salary'],
    ['Kindergeld', '', 'inc_childBenefit'], // empty → ignored
    ['Miete / Finanzierung', 950, 'exp_housing'],
    ['Kredite', 120, 'exp_loans'],
  ];

  it('is recognised and parsed by its machine keys', () => {
    expect(isTemplate([{ name: 'Kundendaten', rows }])).toBe(true);
    const d = parseTemplate([{ name: 'Kundendaten', rows }])!;
    expect(d.count).toBe(8);
    expect(d.name).toBe('Max Muster');
    expect(d.birthDate).toBe('1990-06-01');
    expect(d.children).toEqual([{ birthYear: 2018 }, { birthYear: 2021 }]);
  });

  it('reads several adults and children with dates', () => {
    const more = [
      [TEMPLATE_MARKER, '', ''],
      ['1', 'Eva', 'adult0Name'],
      ['2', 'Lena', 'adult1Name'],
      ['3', '02.02.2005', 'adult1BirthDate'],
      ['4', '03.05.2019, 2021', 'children'],
    ];
    const d = parseTemplate([{ name: 'Kundendaten', rows: more }])!;
    expect(d.adults.map((a) => a.name)).toEqual(['Eva', 'Lena']);
    expect(d.children).toEqual([{ birthDate: '2019-05-03' }, { birthYear: 2021 }]);
  });

  it('fills client and household, replacing existing categories', () => {
    const s = applyTemplate(defaultState(), parseTemplate([{ name: 'Kundendaten', rows }])!);
    expect(s.input.client.name).toBe('Max Muster');
    expect(s.input.client.birthDate).toBe('1990-06-01');
    expect(s.input.client.adults[0]).toMatchObject({ name: 'Eva Muster', birthDate: '1988-03-15' });
    expect(s.household.income.find((l) => l.key === 'inc_salary')?.amount).toBe(2900);
    expect(s.household.expenses.find((l) => l.key === 'exp_housing')?.amount).toBe(950);
    expect(s.household.expenses.find((l) => l.key === 'exp_loans')?.amount).toBe(120);
  });
});
