// Portfolio projection engine – pure functions, no UI dependencies.
//
// Conventions (identical to the existing AVD offer PDFs, verified against them):
//  - annual compounding
//  - one-off amounts and the AVD starter bonus are invested at the start
//  - regular contributions and subsidies of a year are added at the end of that year
//  - no taxes (shown as gross values, see disclaimer)

import { AVD_RULES, annualSubsidy, starterBonusApplies } from './avd';
import {
  SCENARIOS,
  type PortfolioInput,
  type Position,
  type PositionProjection,
  type Product,
  type Projection,
  type ScenarioKey,
  type ScenarioProjection,
  type YearPoint,
} from './types';

export type Catalog = Record<string, Product>;

export function positionAmounts(input: PortfolioInput, position: Position, product: Product) {
  return {
    monthly: input.totalMonthly * position.monthlyWeight,
    oneOff: product.allowsOneOff ? input.totalOneOff * position.oneOffWeight : 0,
  };
}

export function projectPosition(
  input: PortfolioInput,
  position: Position,
  product: Product,
  scenario: ScenarioKey,
): PositionProjection {
  const { monthly, oneOff } = positionAmounts(input, position, product);
  const r = product.returns[scenario];
  const entry = product.entryFee ?? 0;
  const annualFee = product.annualFee ?? 0;
  const exit = product.exitFee ?? 0;
  const isAvd = product.kind === 'avd';

  let value = 0;
  let paidIn = 0;
  let subsidy = 0;
  let fees = 0;

  // t = 0: one-off investment and starter bonus
  if (oneOff > 0) {
    paidIn += oneOff;
    fees += oneOff * entry;
    value += oneOff * (1 - entry);
  }
  if (isAvd && monthly > 0 && starterBonusApplies(input.client.age)) {
    subsidy += AVD_RULES.starterBonus;
    value += AVD_RULES.starterBonus;
  }

  const point = (year: number): YearPoint => ({
    year,
    value,
    netValue: value * (1 - exit),
    paidIn,
    subsidy,
    fees,
  });

  const series: YearPoint[] = [point(input.startYear)];

  for (let y = 1; y <= input.horizonYears; y++) {
    const calendarYear = input.startYear + y - 1;
    // growth and running costs on last year's value
    const grown = value * (1 + r);
    fees += grown * annualFee;
    value = grown * (1 - annualFee);

    // contributions of this year (with Dynamik), added at year end
    let annualOwn = monthly * 12 * Math.pow(1 + input.dynamicIncrease, y - 1);
    if (isAvd) annualOwn = Math.min(annualOwn, AVD_RULES.maxAnnualContribution);
    paidIn += annualOwn;
    fees += annualOwn * entry;
    value += annualOwn * (1 - entry);

    if (isAvd && annualOwn > 0) {
      const s = annualSubsidy(annualOwn, input.client.childrenBirthYears, calendarYear);
      subsidy += s;
      value += s;
    }
    series.push(point(input.startYear + y));
  }

  return { position, product, monthly, oneOff, series };
}

function sumSeries(positions: PositionProjection[], input: PortfolioInput): YearPoint[] {
  const out: YearPoint[] = [];
  for (let i = 0; i <= input.horizonYears; i++) {
    const p: YearPoint = { year: input.startYear + i, value: 0, netValue: 0, paidIn: 0, subsidy: 0, fees: 0 };
    for (const pos of positions) {
      const s = pos.series[i];
      p.value += s.value;
      p.netValue += s.netValue;
      p.paidIn += s.paidIn;
      p.subsidy += s.subsidy;
      p.fees += s.fees;
    }
    out.push(p);
  }
  return out;
}

export function projectScenario(input: PortfolioInput, catalog: Catalog, scenario: ScenarioKey): ScenarioProjection {
  const positions = input.positions
    .filter((p) => catalog[p.productId])
    .map((p) => projectPosition(input, p, catalog[p.productId], scenario));
  return { scenario, positions, total: sumSeries(positions, input) };
}

export function project(input: PortfolioInput, catalog: Catalog): Projection {
  return Object.fromEntries(SCENARIOS.map((s) => [s, projectScenario(input, catalog, s)])) as Projection;
}

/** Converts a nominal amount at year index t into today's purchasing power. */
export function toReal(amount: number, t: number, inflation: number): number {
  return amount / Math.pow(1 + inflation, t);
}

/** Gains = value − own contributions − subsidies. */
export function gains(p: YearPoint): number {
  return p.netValue - p.paidIn - p.subsidy;
}

export interface Warning {
  key: 'monthlyWeights' | 'oneOffWeights' | 'avdMax' | 'avdHorizon' | 'minMonthly' | 'minOneOff' | 'overBudget';
  productId?: string;
}

/** Checks weights and product limits; returns warnings for the UI. */
export function validateWeights(input: PortfolioInput, catalog: Catalog) {
  const sum = (key: 'monthlyWeight' | 'oneOffWeight') =>
    input.positions
      .filter((p) => key === 'monthlyWeight' || catalog[p.productId]?.allowsOneOff)
      .reduce((a, p) => a + p[key], 0);
  const warnings: Warning[] = [];
  const monthlySum = sum('monthlyWeight');
  const oneOffSum = sum('oneOffWeight');
  if (input.totalMonthly > 0 && Math.abs(monthlySum - 1) > 0.001) warnings.push({ key: 'monthlyWeights' });
  if (input.totalOneOff > 0 && Math.abs(oneOffSum - 1) > 0.001) warnings.push({ key: 'oneOffWeights' });
  for (const p of input.positions) {
    const product = catalog[p.productId];
    if (!product) continue;
    const { monthly, oneOff } = positionAmounts(input, p, product);
    const w = (key: Warning['key']) => warnings.push({ key, productId: product.id });
    if (product.kind === 'avd' && monthly * 12 > AVD_RULES.maxAnnualContribution) w('avdMax');
    if (product.kind === 'avd' && monthly > 0 && input.client.age + input.horizonYears > AVD_RULES.payoutLatestAge) w('avdHorizon');
    if (product.minMonthly && monthly > 0 && monthly < product.minMonthly) w('minMonthly');
    if (product.minOneOff && oneOff > 0 && oneOff < product.minOneOff) w('minOneOff');
  }
  return { monthlySum, oneOffSum, warnings };
}
