// Money journey: view model (which money, which ages) and chart options.

import type { EChartsOption } from 'echarts';
import { computeJourney, type Journey } from '../engine/journey';
import { adultOwner, ageAtStart } from '../engine/person';
import { positionTiming, toReal } from '../engine/projection';
import type { PortfolioInput, Projection, YearPoint } from '../engine/types';
import type { OutputSettings } from '../state';
import type { ViewModel } from './model';

export interface JourneyView extends Journey {
  /** What the journey is about, e.g. "Altersvorsorgedepot (AVD) (Anna)" or "Gesamtes Portfolio". */
  title: string;
  /** Average return of the saving phase in the displayed scenario. */
  savingReturn: number;
  payoutReturn: number;
  endAge: number;
}

export const JOURNEY_PORTFOLIO = 'portfolio';

export function buildJourney(
  input: PortfolioInput,
  projection: Projection,
  output: OutputSettings,
  real: boolean,
  names: { uid: string; name: string; visible: boolean }[],
  portfolioTitle: string,
  avgReturn: number,
): JourneyView | undefined {
  const s = output.journey;
  const shown = projection[output.scenario].positions.filter((p) => names.find((n) => n.uid === p.position.uid)?.visible);
  const avds = shown.filter((p) => p.product.kind === 'avd');
  const target = s.target === JOURNEY_PORTFOLIO ? undefined : avds.find((p) => p.position.uid === s.target) ?? avds[0];
  const deflate = (v: number, i: number) => (real ? toReal(v, i, input.inflation) : v);
  const settings = { lumpSum: s.lumpSum, payoutReturn: s.payoutReturn, endAge: s.endAge, payoutAge: s.payoutAge };

  if (target) {
    const owner = adultOwner(input.client, target.position.owner) ?? input.client;
    const t = positionTiming(input, target.position);
    const endIdx = Math.max(0, t.year - input.startYear) + t.years;
    const j = computeJourney(target.series, ageAtStart(owner, input.startYear), endIdx, settings, deflate);
    const title = names.find((n) => n.uid === target.position.uid)?.name ?? target.product.name.de;
    return { ...j, title, savingReturn: target.product.returns[output.scenario], payoutReturn: s.payoutReturn, endAge: s.endAge };
  }
  if (shown.length === 0) return undefined;
  // whole portfolio: the shown products together, payouts from the end of the last contract
  const total: YearPoint[] = shown[0].series.map((_, i) =>
    shown.reduce(
      (acc, p) => {
        const x = p.series[i];
        return { ...acc, value: acc.value + x.value, netValue: acc.netValue + x.netValue, paidIn: acc.paidIn + x.paidIn, subsidy: acc.subsidy + x.subsidy, childSubsidy: acc.childSubsidy + x.childSubsidy, fees: acc.fees + x.fees };
      },
      { year: shown[0].series[i].year, value: 0, netValue: 0, paidIn: 0, subsidy: 0, childSubsidy: 0, fees: 0 },
    ),
  );
  const j = computeJourney(total, ageAtStart(input.client, input.startYear), input.horizonYears, settings, deflate);
  return { ...j, title: portfolioTitle, savingReturn: avgReturn, payoutReturn: s.payoutReturn, endAge: s.endAge };
}

export const JOURNEY_COLORS = { own: '#9DB8D9' };

export function journeyOption(vm: ViewModel, j: JourneyView, o: { animation?: boolean; compact?: boolean; narrow?: boolean } = {}): EChartsOption {
  const { t, fmt } = vm;
  const c = vm.theme.colors;
  const fs = o.compact ? 9 : 11;
  const ages = j.ages.map(String);
  const payoutIdx = j.ages.indexOf(j.payoutAge);
  const top = (j.own[payoutIdx] ?? 0) + (j.subsidy[payoutIdx] ?? 0) + (j.growth[payoutIdx] ?? 0);
  const area = (name: string, data: (number | null)[], color: string, opacity = 0.9) => ({
    name,
    type: 'line' as const,
    stack: 'saving',
    data,
    showSymbol: false,
    connectNulls: false,
    lineStyle: { width: 0 },
    itemStyle: { color },
    areaStyle: { color, opacity },
  });
  const label = (text: string) => ({
    formatter: text,
    color: c.text,
    fontSize: fs,
    fontWeight: 600 as const,
    backgroundColor: c.background,
    borderColor: c.accent,
    borderWidth: 1,
    borderRadius: 3,
    padding: [3, 6],
  });

  return {
    animation: o.animation ?? true,
    textStyle: { fontFamily: vm.theme.fonts.body, color: c.text },
    grid: { left: 8, right: 24, top: o.compact ? 44 : 52, bottom: o.compact ? 44 : 52, containLabel: true },
    legend: { type: o.narrow ? 'scroll' : 'plain', bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: c.text, fontSize: fs } },
    tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '–' : fmt.eur(Number(v))) },
    xAxis: {
      type: 'category',
      data: ages,
      boundaryGap: false,
      axisLabel: { color: c.muted, fontSize: fs, interval: (i: number) => (j.ages[i] % 5 === 0 && Math.abs(i - payoutIdx) > 1) || i === payoutIdx },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#D5DAE1' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.muted, fontSize: fs, formatter: (v: number) => fmt.eurShort(v) },
      splitLine: { lineStyle: { color: '#EEF0F3' } },
    },
    series: [
      {
        ...area(t('kpiPaidIn'), j.own, JOURNEY_COLORS.own),
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(0,0,0,0)' },
          label: { color: c.muted, fontSize: fs, fontWeight: 600, position: 'insideTop', distance: o.compact ? -30 : -36 },
          data: [
            [
              { name: o.narrow ? t('savingPhase').toUpperCase() : `${t('savingPhase').toUpperCase()} · ${t('avgPa', { rate: fmt.pct(j.savingReturn) })}`, xAxis: ages[0] },
              { xAxis: ages[payoutIdx] },
            ],
            [
              { name: o.narrow ? t('payoutPhase').toUpperCase() : `${t('payoutPhase').toUpperCase()} · ${fmt.pct(j.payoutReturn)} p. a.`, xAxis: ages[payoutIdx] },
              { xAxis: ages[ages.length - 1] },
            ],
          ],
        },
      },
      area(t('kpiSubsidy'), j.subsidy, c.accent),
      {
        ...area(t('kpiGains'), j.growth, c.primary),
        markPoint: {
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: c.background, borderColor: c.accent, borderWidth: 2 },
          data: [
            {
              name: 'capital',
              coord: [ages[payoutIdx], top],
              label: { ...label(`${fmt.eur(j.capitalAtStart)}`), position: 'left', distance: 10 },
            },
          ],
        },
      },
      {
        name: t('remainingCapital'),
        type: 'line',
        data: j.capital,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color: c.primary },
        itemStyle: { color: c.primary },
        areaStyle: { color: c.primary, opacity: 0.18 },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: c.muted, type: 'dashed', width: 1 },
          label: { show: false },
          data: [{ xAxis: ages[payoutIdx] }],
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: { color: c.background, borderColor: c.primary, borderWidth: 2 },
          data: [
            // on a phone the labels would overlap; the figures below the chart show the amounts
            ...(j.lumpSum > 0 && !o.narrow
              ? [
                  {
                    name: 'lump',
                    coord: [ages[payoutIdx], j.capital[payoutIdx]!],
                    label: { ...label(`${t('kpiLump')} ${fmt.eur(j.lumpSum)}`), position: 'bottom' as const, distance: 12 },
                  },
                ]
              : []),
            // the first amount is in the figures below; label every second recalculation after it
            ...j.steps
              .filter((_, k) => k % 2 === 1 && !o.narrow)
              .map((s) => {
                const i = j.ages.indexOf(s.age);
                return {
                  name: `payout-${s.age}`,
                  coord: [ages[i], j.capital[i] ?? 0],
                  label: { ...label(`${fmt.eur(s.monthly)}${t('perMonth')}`), position: 'top' as const, distance: 8 },
                };
              }),
          ],
        },
      },
    ],
  };
}
