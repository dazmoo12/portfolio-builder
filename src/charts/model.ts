// View model shared by the live preview, the PDF report and the PowerPoint export.
// It turns a projection into display-ready numbers for one selected year.

import { gains, toReal } from '../engine/projection';
import { SCENARIOS, type Lang, type PortfolioInput, type Product, type Projection, type ScenarioKey, type YearPoint } from '../engine/types';
import { makeFormat, makeT, type Format, type T } from '../i18n';
import type { OutputSettings } from '../state';
import type { Theme } from '../templates/themes';

export interface PositionView {
  uid: string;
  product: Product;
  name: string;
  color: string;
  monthly: number;
  oneOff: number;
  value: number;
  paidIn: number;
  subsidy: number;
  gains: number;
}

export interface ViewModel {
  lang: Lang;
  t: T;
  fmt: Format;
  theme: Theme;
  input: PortfolioInput;
  real: boolean;
  output: OutputSettings;
  /** Scenario all figures refer to. */
  scenario: ScenarioKey;
  /** Contribution-weighted average return of the displayed scenario. */
  avgReturn: number;
  yearIndex: number;
  year: number;
  ageAtYear: number;
  years: number[];
  positions: PositionView[];
  /** value etc. refer to the displayed scenario; pessimistic/neutral/optimistic are the totals of all scenarios. */
  kpi: { value: number; paidIn: number; subsidy: number; gains: number } & Record<ScenarioKey, number>;
  development: {
    positions: { name: string; color: string; values: number[] }[];
    totals: Record<ScenarioKey, number[]>;
    paidIn: number[];
  };
  hasAvd: boolean;
}

const OVERFLOW_COLOR = '#8C939D';

export function buildViewModel(
  input: PortfolioInput,
  projection: Projection,
  theme: Theme,
  lang: Lang,
  yearIndex: number,
  real: boolean,
  output: OutputSettings,
): ViewModel {
  const t = makeT(lang);
  const fmt = makeFormat(lang);
  const yi = Math.min(Math.max(yearIndex, 0), input.horizonYears);
  const adj = (v: number, i: number) => (real ? toReal(v, i, input.inflation) : v);
  const scenario = output.scenario;
  const shown = projection[scenario];

  const positions: PositionView[] = shown.positions.map((p, idx) => {
    const s: YearPoint = p.series[yi];
    return {
      uid: p.position.uid,
      product: p.product,
      name: p.product.name[lang],
      // colour follows the position (entity), fixed order; beyond the palette → neutral grey
      color: theme.colors.series[idx] ?? OVERFLOW_COLOR,
      monthly: p.monthly,
      oneOff: p.oneOff,
      value: adj(s.netValue, yi),
      paidIn: adj(s.paidIn, yi),
      subsidy: adj(s.subsidy, yi),
      gains: adj(gains(s), yi),
    };
  });

  const totalAt = (sc: keyof Projection, i: number) => adj(projection[sc].total[i].netValue, i);
  const range = Array.from({ length: input.horizonYears + 1 }, (_, i) => i);
  const tot = shown.total[yi];

  // weight each product's return by what is paid into it over the horizon
  let wSum = 0;
  let rSum = 0;
  for (const p of shown.positions) {
    const w = p.monthly * 12 * input.horizonYears + p.oneOff;
    wSum += w;
    rSum += w * p.product.returns[scenario];
  }

  return {
    lang,
    t,
    fmt,
    theme,
    input,
    real,
    output,
    scenario,
    avgReturn: wSum > 0 ? rSum / wSum : 0,
    yearIndex: yi,
    year: input.startYear + yi,
    ageAtYear: input.client.age + yi,
    years: range.map((i) => input.startYear + i),
    positions,
    kpi: {
      value: adj(tot.netValue, yi),
      paidIn: adj(tot.paidIn, yi),
      subsidy: adj(tot.subsidy, yi),
      gains: adj(gains(tot), yi),
      pessimistic: totalAt('pessimistic', yi),
      neutral: totalAt('neutral', yi),
      optimistic: totalAt('optimistic', yi),
    },
    development: {
      positions: shown.positions.map((p, idx) => ({
        name: p.product.name[lang],
        color: theme.colors.series[idx] ?? OVERFLOW_COLOR,
        values: range.map((i) => adj(p.series[i].netValue, i)),
      })),
      totals: Object.fromEntries(SCENARIOS.map((sc) => [sc, range.map((i) => totalAt(sc, i))])) as Record<ScenarioKey, number[]>,
      paidIn: range.map((i) => adj(shown.total[i].paidIn + shown.total[i].subsidy, i)),
    },
    hasAvd: positions.some((p) => p.product.kind === 'avd'),
  };
}
