import { describe, expect, it } from 'vitest';
import { baseSubsidy, annualSubsidy } from './avd';
import { summarizeHousehold } from './household';
import { ageAtStart, ageOn, validBirthDate } from './person';
import { clientDisplayName, project, syncTimeline, validateWeights, type Catalog } from './projection';
import type { PortfolioInput, Product } from './types';

const avd: Product = {
  id: 'avd',
  kind: 'avd',
  group: 'pension',
  name: { de: 'AVD', en: 'AVD', pt: 'AVD' },
  description: { de: '', en: '', pt: '' },
  returns: { pessimistic: 0.07, neutral: 0.07, optimistic: 0.07 },
  allowsOneOff: false,
};
const catalog: Catalog = { avd };

function avdOnly(monthly: number, age: number, years: number): PortfolioInput {
  return {
    client: { name: 'Test', age, children: [], adults: [] },
    startYear: 2027,
    horizonYears: years,
    totalMonthly: monthly,
    totalOneOff: 0,
    dynamicIncrease: 0,
    inflation: 0.02,
    positions: [{ uid: '1', productId: 'avd', monthlyWeight: 1, oneOffWeight: 0 }],
  };
}

describe('AVD subsidy', () => {
  it('follows the two-stage rule', () => {
    expect(baseSubsidy(360)).toBe(180);
    expect(baseSubsidy(480)).toBe(210); // offer "Marny": 40 €/month
    expect(baseSubsidy(1800)).toBe(540);
    expect(baseSubsidy(6840)).toBe(540); // capped
  });
  it('adds 1:1 child bonus up to 300 € per eligible child', () => {
    expect(annualSubsidy(1800, [2015, 2020], 2027)).toBe(540 + 600);
    expect(annualSubsidy(200, [2015], 2027)).toBe(baseSubsidy(200) + 200);
    expect(annualSubsidy(1800, [2000], 2027)).toBe(540); // child already 27
  });
});

describe('projection matches existing AVD offers', () => {
  it('offer "Philipp": 150 €/month, age 24, 42 years → 543,108 €', () => {
    const t = project(avdOnly(150, 24, 42), catalog).neutral.total.at(-1)!;
    expect(Math.round(t.value)).toBe(543108);
    expect(t.paidIn).toBe(75600);
    expect(t.subsidy).toBe(22880);
  });
  it('offer "Marny": 40 €/month, age 55, 12 years → 12,343 €', () => {
    const t = project(avdOnly(40, 55, 12), catalog).neutral.total.at(-1)!;
    expect(Math.round(t.value)).toBe(12343);
    expect(t.paidIn).toBe(5760);
    expect(t.subsidy).toBe(2520);
  });
});

describe('several adults', () => {
  const base = avdOnly(150, 24, 42);
  const two = (over: Partial<PortfolioInput['client']> = {}): PortfolioInput => ({
    ...base,
    client: { ...base.client, children: [{ id: 'k', birthYear: 2027 }], adults: [{ id: 'max', name: 'Max', age: 40 }], ...over },
    totalMonthly: 300,
    positions: [
      { uid: 'a', productId: 'avd', monthlyWeight: 0.5, oneOffWeight: 0 },
      { uid: 'b', productId: 'avd', monthlyWeight: 0.5, oneOffWeight: 0, owner: 'max' },
    ],
  });
  const subsidy = (input: PortfolioInput) => project(input, catalog).neutral.positions.map((p) => p.series[1].subsidy);

  it('gives each person their own AVD subsidy and starter bonus by their own age', () => {
    // client (24): 200 starter + 540 + 300 child; Max (40): 540 only
    expect(subsidy(two())).toEqual([1040, 540]);
  });

  it('counts a child only for the parent receiving the child bonus', () => {
    expect(subsidy(two({ childBonusOwner: 'max' }))).toEqual([740, 840]);
  });

  it('falls back to the client when the adult is removed', () => {
    const input = { ...two(), client: { ...two().client, adults: [], childBonusOwner: 'max' } };
    expect(subsidy(input)).toEqual([1040, 1040]);
    expect(validateWeights(input, catalog).warnings.map((w) => w.key)).toContain('avdDuplicate');
  });

  it('names all adults', () => {
    expect(clientDisplayName(two().client)).toBe('Test & Max');
    expect(clientDisplayName(base.client)).toBe('Test');
    const three = two({ adults: [{ id: 'm', name: 'Max', age: 40 }, { id: 'l', name: 'Lena', age: 19 }] });
    expect(clientDisplayName(three.client)).toBe('Test, Max & Lena');
  });

  it('gives a grown-up child their own starter bonus', () => {
    const input = two({ adults: [{ id: 'lena', name: 'Lena', age: 19 }], children: [] });
    const withLena = { ...input, positions: input.positions.map((p) => (p.owner ? { ...p, owner: 'lena' } : p)) };
    expect(subsidy(withLena)).toEqual([740, 740]);
  });
});

describe('start and term per contract', () => {
  const fund: Product = { ...avd, id: 'fund', kind: 'fund', group: 'fund', allowsOneOff: true, returns: { pessimistic: 0.1, neutral: 0.1, optimistic: 0.1 } };
  const input = (positions: PortfolioInput['positions']): PortfolioInput =>
    syncTimeline({ ...avdOnly(100, 40, 1), totalMonthly: 100, positions });
  const timing = (weight: number, start: string, years: number) => ({ uid: start, productId: 'fund', monthlyWeight: weight, oneOffWeight: 0, start, years });

  it('derives the timeline from the contracts', () => {
    const t = input([timing(0.5, '2027-01', 10), timing(0.5, '2030-06', 20)]);
    expect([t.startYear, t.horizonYears]).toEqual([2027, 23]);
  });

  it('keeps a later contract at zero until it starts', () => {
    const s = project(input([timing(0.5, '2027-01', 3), timing(0.5, '2029-01', 1)]), { fund }).neutral.positions[1].series;
    expect(s.map((p) => p.paidIn)).toEqual([0, 0, 0, 600]);
  });

  it('stops contributions and growth after the term', () => {
    const s = project(input([timing(0.5, '2027-01', 1), timing(0.5, '2027-01', 3)]), { fund }).neutral.positions[0].series;
    expect(s.map((p) => p.value)).toEqual([0, 600, 600, 600]);
  });

  it('uses the exact contract start for age-dependent rules', () => {
    const start = (s: string) => {
      const i: PortfolioInput = { ...avdOnly(100, 50, 1), client: { name: 'T', age: 50, birthDate: '2002-06-15', children: [], adults: [] }, positions: [{ uid: 'a', productId: 'avd', monthlyWeight: 1, oneOffWeight: 0, start: s, years: 1 }] };
      return project(syncTimeline(i), catalog).neutral.total[0].subsidy;
    };
    expect(start('2027-06')).toBe(200); // still 24 on 1 June
    expect(start('2027-07')).toBe(0); // 25 on 1 July
  });
});

describe('date of birth', () => {
  const on = (iso: string) => new Date(`${iso}T12:00:00`);

  it('computes the exact age around the birthday', () => {
    expect(ageOn('1994-02-12', on('2026-02-11'))).toBe(31);
    expect(ageOn('1994-02-12', on('2026-02-12'))).toBe(32);
  });

  it('takes precedence over the age field, counted at the start of the investment', () => {
    expect(ageAtStart({ age: 50, birthDate: '1994-02-12' }, 2027)).toBe(32);
    expect(ageAtStart({ age: 50 }, 2027)).toBe(50);
  });

  it('ignores half-typed and future dates', () => {
    expect(ageAtStart({ age: 50, birthDate: '0199-02-12' }, 2027)).toBe(50);
    expect(validBirthDate('2999-01-01', on('2026-11-06'))).toBe(false);
    expect(validBirthDate('', on('2026-11-06'))).toBe(false);
  });

  it('decides the starter bonus', () => {
    const input = (birthDate: string) => ({ ...avdOnly(150, 50, 1), client: { name: 'T', age: 50, birthDate, children: [], adults: [] } });
    const bonus = (birthDate: string) => project(input(birthDate), catalog).neutral.total[0].subsidy;
    expect(bonus('2002-02-12')).toBe(200); // 24 on 1 Jan 2027
    expect(bonus('2001-12-31')).toBe(0); // 25 on 1 Jan 2027
  });
});

describe('metal costs', () => {
  it('applies markup, storage and buyback discount', () => {
    const gold: Product = {
      ...avd,
      id: 'gold',
      kind: 'metal',
      group: 'metal',
      allowsOneOff: true,
      returns: { pessimistic: 0, neutral: 0, optimistic: 0 },
      entryFee: 0.08,
      annualFee: 0.01,
      exitFee: 0.007,
    };
    const input: PortfolioInput = {
      ...avdOnly(0, 40, 1),
      totalOneOff: 1000,
      positions: [{ uid: '1', productId: 'gold', monthlyWeight: 0, oneOffWeight: 1 }],
    };
    const t = project(input, { gold }).neutral.total.at(-1)!;
    expect(t.value).toBeCloseTo(920 * 0.99, 6);
    expect(t.netValue).toBeCloseTo(920 * 0.99 * 0.993, 6);
  });
});

describe('household budget', () => {
  it('computes surplus and reserve after the proposed savings', () => {
    const s = summarizeHousehold(
      {
        income: [{ id: 'a', amount: 3200 }, { id: 'b', amount: 255 }],
        expenses: [{ id: 'c', amount: 1100 }, { id: 'd', amount: 1560 }],
      },
      300,
    );
    expect(s.income).toBe(3455);
    expect(s.expenses).toBe(2660);
    expect(s.surplus).toBe(795);
    expect(s.reserve).toBe(495);
    expect(s.savingsQuota).toBeCloseTo(300 / 3455);
  });
});
