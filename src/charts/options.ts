// ECharts option builders. Used by the live preview and the PDF report.
// The PowerPoint export builds native Office charts from the same ViewModel instead.

import type { EChartsOption } from 'echarts';
import { SCENARIOS, type ScenarioKey } from '../engine/types';
import type { ViewModel } from './model';

interface Opts {
  animation?: boolean;
  /** Smaller fonts/legend for the print report. */
  compact?: boolean;
}

function base(vm: ViewModel, o: Opts) {
  const c = vm.theme.colors;
  return {
    animation: o.animation ?? true,
    textStyle: { fontFamily: vm.theme.fonts.body, color: c.text },
    grid: { left: 8, right: 16, top: 16, bottom: o.compact ? 56 : 72, containLabel: true },
    axisCommon: {
      axisLine: { lineStyle: { color: '#D5DAE1' } },
      axisTick: { show: false },
      axisLabel: { color: c.muted, fontSize: o.compact ? 9 : 11 },
      splitLine: { lineStyle: { color: '#EEF0F3' } },
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: c.text, fontSize: o.compact ? 9 : 11 },
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: '#D5DAE1',
      textStyle: { color: c.text, fontSize: 12 },
    },
  };
}

const ICON_SOLID = 'path://M0,4h24v2H0z';
const ICON_DASHED = 'path://M0,4h6v2H0z M9,4h6v2H9z M18,4h6v2h-6z';
const ICON_DOTTED = 'path://M0,4h2v2H0z M5,4h2v2H5z M10,4h2v2h-2z M15,4h2v2h-2z M20,4h2v2h-2z';
const ICON_DASHDOT = 'path://M0,4h8v2H0z M11,4h2v2h-2z M16,4h8v2h-8z';

/** Line style of a scenario's total when drawn on top of the displayed scenario. */
const SCENARIO_LINE: Record<ScenarioKey, { type: 'dashed' | 'dotted' | number[]; icon: string }> = {
  optimistic: { type: 'dashed', icon: ICON_DASHED },
  neutral: { type: [8, 4, 2, 4], icon: ICON_DASHDOT },
  pessimistic: { type: 'dotted', icon: ICON_DOTTED },
};

export function developmentOption(vm: ViewModel, o: Opts = {}): EChartsOption {
  const b = base(vm, o);
  const c = vm.theme.colors;
  const d = vm.development;
  const others = vm.output.showRange ? SCENARIOS.filter((sc) => sc !== vm.scenario) : [];
  const totalName = (sc: ScenarioKey) => vm.t('totalScenario', { scenario: vm.t(sc) });
  return {
    animation: b.animation,
    textStyle: b.textStyle,
    grid: b.grid,
    // plain legend wraps onto several lines; explicit icons: squares for the stacked areas,
    // dashed/dotted strokes for the other scenarios' totals, a solid stroke for contributions
    legend: {
      ...b.legend,
      type: 'plain',
      itemWidth: 18,
      data: [
        ...d.positions.map((p) => ({ name: p.name, icon: 'roundRect' })),
        ...others.map((sc) => ({ name: totalName(sc), icon: SCENARIO_LINE[sc].icon })),
        { name: vm.t('paidInLine'), icon: ICON_SOLID },
      ],
    },
    tooltip: {
      ...b.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: c.muted } },
      valueFormatter: (v) => vm.fmt.eur(Number(v)),
    },
    xAxis: { type: 'category', data: vm.years.map(String), boundaryGap: false, ...b.axisCommon },
    yAxis: {
      type: 'value',
      ...b.axisCommon,
      axisLabel: { ...b.axisCommon.axisLabel, formatter: (v: number) => vm.fmt.eurShort(v) },
    },
    series: [
      ...d.positions.map((p) => ({
        name: p.name,
        type: 'line' as const,
        stack: 'total',
        data: p.values,
        showSymbol: false,
        lineStyle: { width: 1, color: '#FFFFFF' },
        itemStyle: { color: p.color },
        areaStyle: { color: p.color, opacity: 0.85 },
        emphasis: { focus: 'series' as const },
      })),
      ...others.map((sc) => ({
        name: totalName(sc),
        type: 'line' as const,
        data: d.totals[sc],
        showSymbol: false,
        lineStyle: { width: 2, type: SCENARIO_LINE[sc].type, color: c.primary },
        itemStyle: { color: c.primary },
      })),
      {
        name: vm.t('paidInLine'),
        type: 'line' as const,
        data: d.paidIn,
        showSymbol: false,
        lineStyle: { width: 2, color: c.muted },
        itemStyle: { color: c.muted },
        markLine: {
          symbol: 'none',
          silent: true,
          label: { formatter: String(vm.year), color: c.text, fontSize: 11 },
          lineStyle: { color: c.accent, width: 2, type: 'solid' },
          data: [{ xAxis: String(vm.year) }],
        },
      },
    ],
  };
}

export function allocationOption(vm: ViewModel, o: Opts = {}): EChartsOption {
  const b = base(vm, o);
  const c = vm.theme.colors;
  if (vm.output.allocationStyle === 'bar') {
    const total = vm.positions.reduce((a, p) => a + Math.max(p.value, 0), 0);
    return {
      animation: b.animation,
      textStyle: b.textStyle,
      grid: { left: 8, right: 90, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...b.tooltip, trigger: 'item', valueFormatter: (v) => vm.fmt.eur(Number(v)) },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        inverse: true,
        data: vm.positions.map((p) => p.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: c.text, fontSize: o.compact ? 9 : 11, width: o.compact ? 120 : 150, overflow: 'break' },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: c.text,
            fontSize: o.compact ? 9 : 11,
            formatter: (p: any) => `${vm.fmt.eur(p.value)} · ${vm.fmt.pct(total > 0 ? p.value / total : 0)}`,
          },
          data: vm.positions.map((p) => ({ value: Math.max(Math.round(p.value), 0), itemStyle: { color: p.color } })),
        },
      ],
    };
  }
  return {
    animation: b.animation,
    textStyle: b.textStyle,
    legend: { ...b.legend, type: 'plain' },
    tooltip: {
      ...b.tooltip,
      trigger: 'item',
      formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${vm.fmt.eur(p.value)}</b> (${vm.fmt.pct(p.percent / 100)})`,
    },
    title: {
      text: vm.fmt.eur(vm.kpi.value),
      subtext: String(vm.year),
      left: 'center',
      top: o.compact ? '33%' : '35%',
      textStyle: { fontFamily: vm.theme.fonts.heading, fontSize: o.compact ? 14 : 18, color: c.text },
      subtextStyle: { color: c.muted, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '74%'],
        center: ['50%', '42%'],
        padAngle: 1,
        itemStyle: { borderColor: '#FFFFFF', borderWidth: 2, borderRadius: 3 },
        label: { show: false },
        data: vm.positions.map((p) => ({ name: p.name, value: Math.max(p.value, 0), itemStyle: { color: p.color } })),
      },
    ],
  };
}

export function compositionOption(vm: ViewModel, o: Opts = {}): EChartsOption {
  const b = base(vm, o);
  const c = vm.theme.colors;
  const names = vm.positions.map((p) => p.name);
  // own money / state money / market return – same colour logic as the existing offer PDFs
  const parts = [
    { key: 'kpiPaidIn' as const, color: '#9DB8D9', get: (p: (typeof vm.positions)[0]) => p.paidIn },
    { key: 'kpiSubsidy' as const, color: c.accent, get: (p: (typeof vm.positions)[0]) => p.subsidy },
    { key: 'kpiGains' as const, color: c.primary, get: (p: (typeof vm.positions)[0]) => p.gains },
  ];
  return {
    animation: b.animation,
    textStyle: b.textStyle,
    grid: { ...b.grid, left: 8 },
    legend: b.legend,
    tooltip: {
      ...b.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => vm.fmt.eur(Number(v)),
    },
    xAxis: {
      type: 'value',
      ...b.axisCommon,
      axisLabel: { ...b.axisCommon.axisLabel, formatter: (v: number) => vm.fmt.eurShort(v) },
    },
    yAxis: {
      type: 'category',
      data: names,
      inverse: true,
      ...b.axisCommon,
      axisLabel: { ...b.axisCommon.axisLabel, color: c.text, width: o.compact ? 150 : 190, overflow: 'break' },
    },
    series: parts.map((part) => ({
      name: vm.t(part.key),
      type: 'bar' as const,
      stack: 'x',
      barMaxWidth: 22,
      itemStyle: { color: part.color, borderColor: '#FFFFFF', borderWidth: 1 },
      data: vm.positions.map((p) => Math.round(part.get(p))),
    })),
  };
}

export function scenarioOption(vm: ViewModel, o: Opts = {}): EChartsOption {
  const b = base(vm, o);
  const c = vm.theme.colors;
  const rows = [
    { name: vm.t('pessimistic'), value: vm.kpi.pessimistic, color: '#9DB8D9' },
    { name: vm.t('neutral'), value: vm.kpi.neutral, color: c.primary },
    { name: vm.t('optimistic'), value: vm.kpi.optimistic, color: c.accent },
  ];
  return {
    animation: b.animation,
    textStyle: b.textStyle,
    grid: { ...b.grid, top: 28, bottom: 8 },
    tooltip: { ...b.tooltip, trigger: 'item', valueFormatter: (v) => vm.fmt.eur(Number(v)) },
    xAxis: { type: 'category', data: rows.map((r) => r.name), ...b.axisCommon, axisLabel: { ...b.axisCommon.axisLabel, color: c.text } },
    yAxis: {
      type: 'value',
      ...b.axisCommon,
      axisLabel: { ...b.axisCommon.axisLabel, formatter: (v: number) => vm.fmt.eurShort(v) },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 56,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: c.text,
          fontSize: o.compact ? 10 : 12,
          formatter: (p: any) => vm.fmt.eur(p.value),
        },
        data: rows.map((r) => ({ value: Math.round(r.value), itemStyle: { color: r.color } })),
      },
    ],
  };
}
