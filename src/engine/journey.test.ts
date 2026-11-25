import { describe, expect, it } from 'vitest';
import { annualPayout, computeJourney } from './journey';
import type { YearPoint } from './types';

// saving: 1,000 € per year for 3 years, no growth
const points: YearPoint[] = [0, 1, 2, 3].map((i) => ({ year: 2027 + i, value: i * 1000, netValue: i * 1000, paidIn: i * 1000, subsidy: 0, childSubsidy: 0, fees: 0 }));
const settings = { lumpSum: 0.3, payoutReturn: 0.04, endAge: 85 };

describe('money journey', () => {
  it('uses the capital up exactly by the end age', () => {
    const p = annualPayout(100_000, 0.04, 20);
    let c = 100_000;
    for (let y = 0; y < 20; y++) c = (c - p) * 1.04;
    expect(c).toBeCloseTo(0, 6);
  });

  it('pays the lump sum and then level payouts with a constant return', () => {
    const j = computeJourney(points, 62, 3, settings);
    expect(j.payoutAge).toBe(65);
    expect(j.capitalAtStart).toBe(3000);
    expect(j.lumpSum).toBeCloseTo(900);
    expect(j.steps.map((s) => s.age)).toEqual([65, 68, 71, 74, 77, 80, 83]);
    const first = j.steps[0].monthly;
    for (const s of j.steps) expect(s.monthly).toBeCloseTo(first, 6); // recalculation keeps it level
    expect(j.totals.left).toBeCloseTo(0, 6);
    expect(j.totals.total).toBeCloseTo(j.totals.lumpSum + j.totals.payouts);
    expect(j.ages[0]).toBe(62);
    expect(j.ages.at(-1)).toBe(85);
  });

  it('caps the lump sum at the AVD maximum of 30 %', () => {
    expect(computeJourney(points, 62, 3, { ...settings, lumpSum: 0.5 }).lumpSum).toBeCloseTo(900);
  });

  it('waits until 65 when contributions end earlier', () => {
    const j = computeJourney(points, 50, 3, settings);
    expect(j.payoutAge).toBe(65);
    expect(j.waitsForPayout).toBe(true);
    expect(j.capitalAtStart).toBe(3000); // unchanged while waiting
  });

  it('starts payouts at 65 even when the contract runs longer', () => {
    const j = computeJourney(points, 63, 3, settings);
    expect(j.payoutAge).toBe(65);
    expect(j.cutAtPayout).toBe(true);
    expect(j.contractEndAge).toBe(66);
    expect(j.capitalAtStart).toBe(2000); // contributions after 65 are left out
  });

  it('uses a later planned payout age', () => {
    expect(computeJourney(points, 50, 3, { ...settings, payoutAge: 67 }).payoutAge).toBe(67);
    expect(computeJourney(points, 50, 3, { ...settings, payoutAge: 80 }).payoutAge).toBe(70);
  });

  it('flags payouts starting after 70', () => {
    expect(computeJourney(points, 70, 3, settings).tooLate).toBe(true);
  });

  it('converts to today\'s purchasing power when asked', () => {
    const real = computeJourney(points, 62, 3, settings, (v, i) => v / Math.pow(1.02, i));
    expect(real.capitalAtStart).toBeCloseTo(3000 / Math.pow(1.02, 3));
  });
});
