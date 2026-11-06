// View model shared by the live preview, the PDF report and the PowerPoint export.
// It turns a projection into display-ready numbers for one selected year.

import { adultOwner, ageAtStart, ageToday, clientPeople, validBirthDate } from '../engine/person';
import { clientDisplayName, gains, positionTiming, toReal } from '../engine/projection';
import { SCENARIOS, type Lang, type PortfolioInput, type PositionProjection, type Product, type Projection, type ScenarioKey, type YearPoint } from '../engine/types';
import { makeFormat, makeT, type Format, type T } from '../i18n';
import type { OutputSettings } from '../state';
import type { Theme } from '../templates/themes';

export interface PositionView {
  uid: string;
  product: Product;
  name: string;
  /** Start and term, e.g. "11/2026 · 12 Jahre". */
  timing: string;
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
  /** Both adults' names if there is a second adult. */
  clientName: string;
  ageToday: string;
  /** Dates of birth for the output; empty if none is known. */
  birthDates: string;
  /** Explains the values of contracts that end before the timeline does. */
  termNote: string;
  ageAtYear: string;
  years: number[];
  /** The positions shown; everything below refers to these only. */
  positions: PositionView[];
  /** Every position, for the product selection and chart legends. */
  allPositions: { uid: string; name: string; color: string; visible: boolean }[];
  hiddenNames: string[];
  amounts: { monthly: number; oneOff: number };
  /** value etc. refer to the displayed scenario; pessimistic/neutral/optimistic are the totals of all scenarios. */
  kpi: { value: number; paidIn: number; subsidy: number; gains: number } & Record<ScenarioKey, number>;
  development: {
    positions: { name: string; color: string; visible: boolean; values: number[] }[];
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
  const hidden = new Set(output.hidden);
  const client = input.client;

  // names must be unique: chart legends identify a product by its name
  const seen = new Map<string, number>();
  const nameOf = (p: PositionProjection) => {
    let name = p.product.name[lang];
    if (p.product.kind === 'avd' && client.adults.length > 0) {
      const person = adultOwner(client, p.position.owner)?.name ?? client.name;
      name += ` (${person.trim().split(/\s+/)[0] || t('secondAdult')})`;
    }
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n > 1 ? `${name} ${n}` : name;
  };

  const all = projection[scenario].positions.map((p, idx) => ({
    p,
    idx,
    name: nameOf(p),
    // colour follows the position (entity), fixed order; beyond the palette → neutral grey
    color: theme.colors.series[idx] ?? OVERFLOW_COLOR,
    visible: !hidden.has(p.position.uid),
  }));
  const shown = all.filter((a) => a.visible);
  const range = Array.from({ length: input.horizonYears + 1 }, (_, i) => i);

  const positions: PositionView[] = shown.map(({ p, name, color }) => {
    const s: YearPoint = p.series[yi];
    const timing = positionTiming(input, p.position);
    return {
      timing: `${String(timing.month).padStart(2, '0')}/${timing.year} · ${timing.years} ${t('reportYears')}`,
      uid: p.position.uid,
      product: p.product,
      name,
      color,
      monthly: p.monthly,
      oneOff: p.oneOff,
      value: adj(s.netValue, yi),
      paidIn: adj(s.paidIn, yi),
      subsidy: adj(s.subsidy, yi),
      gains: adj(gains(s), yi),
    };
  });

  // totals cover the shown positions only (same order in every scenario)
  const sumAt = (sc: ScenarioKey, i: number, get: (s: YearPoint) => number) =>
    shown.reduce((a, { idx }) => a + get(projection[sc].positions[idx].series[i]), 0);
  const totalAt = (sc: ScenarioKey, i: number) => adj(sumAt(sc, i, (s) => s.netValue), i);
  const paidIn = sumAt(scenario, yi, (s) => s.paidIn);
  const subsidy = sumAt(scenario, yi, (s) => s.subsidy);
  const value = sumAt(scenario, yi, (s) => s.netValue);

  // weight each product's return by what is paid into it over the horizon
  let wSum = 0;
  let rSum = 0;
  for (const { p } of shown) {
    const w = p.monthly * 12 * positionTiming(input, p.position).years + p.oneOff;
    wSum += w;
    rSum += w * p.product.returns[scenario];
  }

  const people = clientPeople(client);
  const lastYear = input.startYear + input.horizonYears;
  const endsEarly = shown.some(({ p }) => {
    const c = positionTiming(input, p.position);
    return c.year + c.years < lastYear;
  });
  const ages = (add: number) => people.map((p) => ageAtStart(p, input.startYear) + add).join(' / ');
  const dates = people.map((p) => (validBirthDate(p.birthDate) ? fmt.date(p.birthDate) : '–'));

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
    clientName: clientDisplayName(client),
    ageToday: people.map((p) => ageToday(p)).join(' / '),
    birthDates: dates.some((d) => d !== '–') ? dates.join(' / ') : '',
    termNote: endsEarly ? t('reportTermNote') : '',
    yearIndex: yi,
    year: input.startYear + yi,
    ageAtYear: ages(yi),
    years: range.map((i) => input.startYear + i),
    positions,
    allPositions: all.map((a) => ({ uid: a.p.position.uid, name: a.name, color: a.color, visible: a.visible })),
    hiddenNames: all.filter((a) => !a.visible).map((a) => a.name),
    amounts: { monthly: positions.reduce((a, p) => a + p.monthly, 0), oneOff: positions.reduce((a, p) => a + p.oneOff, 0) },
    kpi: {
      value: adj(value, yi),
      paidIn: adj(paidIn, yi),
      subsidy: adj(subsidy, yi),
      gains: adj(value - paidIn - subsidy, yi),
      pessimistic: totalAt('pessimistic', yi),
      neutral: totalAt('neutral', yi),
      optimistic: totalAt('optimistic', yi),
    },
    development: {
      positions: all.map((a) => ({ name: a.name, color: a.color, visible: a.visible, values: range.map((i) => adj(a.p.series[i].netValue, i)) })),
      totals: Object.fromEntries(SCENARIOS.map((sc) => [sc, range.map((i) => totalAt(sc, i))])) as Record<ScenarioKey, number[]>,
      paidIn: range.map((i) => adj(sumAt(scenario, i, (s) => s.paidIn + s.subsidy), i)),
    },
    hasAvd: positions.some((p) => p.product.kind === 'avd'),
  };
}
