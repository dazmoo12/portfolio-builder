import { describe, expect, it } from 'vitest';
import { baseSubsidy, annualSubsidy } from './avd';
import { summarizeHousehold } from './household';
import { project, type Catalog } from './projection';
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
    client: { name: 'Test', age, childrenBirthYears: [] },
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
