// The money journey: saving phase from the projection, then the payout phase.
// Payout rules follow the AVD payout plan: a lump sum at the start, then monthly payouts until
// the end age; the amount is fixed at the start and recalculated every three years.

import { AVD_RULES } from './avd';
import type { YearPoint } from './types';

export interface JourneySettings {
  /** Share of the capital paid out at once when payouts start (AVD: up to 30 %). */
  lumpSum: number;
  /** Return p.a. during the payout phase. */
  payoutReturn: number;
  /** Payouts run until this age. */
  endAge: number;
  /** Planned start of payouts (AVD: 65 to 70). Default 65. */
  payoutAge?: number;
}

export const RECALC_YEARS = 3;

export interface Journey {
  /** Age for each point of the chart, from the start of saving to the end age. */
  ages: number[];
  /** Saving phase (null during payout). */
  own: (number | null)[];
  subsidy: (number | null)[];
  growth: (number | null)[];
  /** Remaining capital during payout (null while saving). */
  capital: (number | null)[];
  payoutAge: number;
  capitalAtStart: number;
  lumpSum: number;
  /** Monthly payout from each recalculation on. */
  steps: { age: number; monthly: number }[];
  totals: { paidIn: number; subsidy: number; lumpSum: number; payouts: number; total: number; left: number };
  /** Contributions ended before 65: the capital waits, unchanged, until payouts may start. */
  waitsForPayout: boolean;
  /** Payouts start later than the AVD allows. */
  tooLate: boolean;
  /** The contract runs past the planned payout start: contributions after it are left out. */
  cutAtPayout: boolean;
  /** Age at which contributions end under the contract term. */
  contractEndAge: number;
}

/** Annual payout at the start of each year that uses the capital up over n years. */
export function annualPayout(capital: number, r: number, years: number): number {
  if (years <= 0) return capital;
  if (Math.abs(r) < 1e-9) return capital / years;
  return (capital * r) / ((1 - Math.pow(1 + r, -years)) * (1 + r));
}

/**
 * @param points  projection of the money in question (index 0 = start of saving)
 * @param age0    owner's age at index 0
 * @param endIdx  index at which contributions end
 * @param deflate converts an amount at index i to today's purchasing power (identity for nominal)
 */
export function computeJourney(
  points: YearPoint[],
  age0: number,
  endIdx: number,
  s: JourneySettings,
  deflate: (v: number, i: number) => number = (v) => v,
): Journey {
  const planned = Math.min(Math.max(s.payoutAge ?? AVD_RULES.payoutEarliestAge, AVD_RULES.payoutEarliestAge), AVD_RULES.payoutLatestAge);
  const contractEndAge = age0 + endIdx;
  // payouts start at the planned age; a contract running longer stops paying in there,
  // a contract ending earlier waits; clients already past the planned age start at contract end
  const payoutAge = age0 < planned ? planned : contractEndAge;
  const payoutIdx = payoutAge - age0;
  const endAge = Math.max(s.endAge, payoutAge);
  // after the term the value stays as it is (see the projection)
  const at = (i: number) => points[Math.min(i, points.length - 1)];

  const ages: number[] = [];
  const own: (number | null)[] = [];
  const subsidy: (number | null)[] = [];
  const growth: (number | null)[] = [];
  const capital: (number | null)[] = [];

  for (let i = 0; i <= payoutIdx; i++) {
    const p = at(i);
    ages.push(age0 + i);
    own.push(deflate(p.paidIn, i));
    subsidy.push(deflate(p.subsidy, i));
    // costs can make the early growth slightly negative; the chart starts it at zero
    growth.push(deflate(Math.max(0, p.netValue - p.paidIn - p.subsidy), i));
    capital.push(null);
  }

  const start = at(payoutIdx);
  const capitalAtStart = start.netValue;
  const lump = capitalAtStart * Math.min(Math.max(s.lumpSum, 0), AVD_RULES.lumpSumShare);
  let c = capitalAtStart - lump;
  capital[payoutIdx] = deflate(c, payoutIdx);

  const steps: Journey['steps'] = [];
  let annual = 0;
  let payouts = 0;
  for (let age = payoutAge; age < endAge; age++) {
    const i = age - age0;
    if ((age - payoutAge) % RECALC_YEARS === 0) {
      annual = annualPayout(c, s.payoutReturn, endAge - age);
      steps.push({ age, monthly: deflate(annual, i) / 12 });
    }
    const paid = Math.min(annual, c);
    payouts += deflate(paid, i);
    c = (c - paid) * (1 + s.payoutReturn);
    ages.push(age + 1);
    own.push(null);
    subsidy.push(null);
    growth.push(null);
    capital.push(deflate(Math.max(c, 0), i + 1));
  }

  const left = Math.max(c, 0);
  return {
    ages,
    own,
    subsidy,
    growth,
    capital,
    payoutAge,
    capitalAtStart: deflate(capitalAtStart, payoutIdx),
    lumpSum: deflate(lump, payoutIdx),
    steps,
    totals: {
      paidIn: deflate(start.paidIn, payoutIdx),
      subsidy: deflate(start.subsidy, payoutIdx),
      lumpSum: deflate(lump, payoutIdx),
      payouts,
      total: deflate(lump, payoutIdx) + payouts,
      left: deflate(left, endAge - age0),
    },
    waitsForPayout: payoutAge > contractEndAge,
    tooLate: payoutAge > AVD_RULES.payoutLatestAge,
    cutAtPayout: payoutAge < contractEndAge,
    contractEndAge,
  };
}
