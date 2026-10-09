// Household budget view model + chart options (preview and PDF; PPTX uses native charts).

import type { EChartsOption } from 'echarts';
import { summarizeHousehold, type BudgetLine, type HouseholdSummary } from '../engine/household';
import type { T, TKey } from '../i18n';
import type { AppState } from '../state';
import { onColor } from '../templates/themes';
import type { ViewModel } from './model';

export function lineLabel(line: BudgetLine, t: T) {
  return line.key ? t(line.key as TKey) : line.label ?? '';
}

export const BUDGET_COLORS = { expenses: '#9DB8D9' };

export interface HouseholdView {
  summary: HouseholdSummary;
  income: { label: string; amount: number }[];
  /** Expense lines, largest first, without zero lines. */
  expenses: { label: string; amount: number }[];
  /** Segments of the income split bar: expenses / proposed savings / remaining reserve. */
  split: { label: string; amount: number; color: string }[];
}

export function buildHouseholdView(state: AppState, vm: ViewModel): HouseholdView {
  const { t } = vm;
  const c = vm.theme.colors;
  const summary = summarizeHousehold(state.household, state.input.totalMonthly);
  const lines = (arr: AppState['household']['income']) =>
    arr.filter((l) => l.amount > 0).map((l) => ({ label: lineLabel(l, t) || '–', amount: l.amount }));
  return {
    summary,
    income: lines(state.household.income),
    expenses: lines(state.household.expenses).sort((a, b) => b.amount - a.amount),
    split: [
      { label: t('kpiExpenses'), amount: summary.expenses, color: BUDGET_COLORS.expenses },
      { label: t('kpiProposed'), amount: Math.min(summary.proposed, Math.max(summary.surplus, 0)), color: c.primary },
      { label: t('kpiReserve'), amount: Math.max(summary.reserve, 0), color: c.accent },
    ],
  };
}

interface Opts {
  animation?: boolean;
  compact?: boolean;
}

export function expensesOption(vm: ViewModel, hv: HouseholdView, o: Opts = {}): EChartsOption {
  const c = vm.theme.colors;
  const fs = o.compact ? 9 : 11;
  return {
    animation: o.animation ?? true,
    textStyle: { fontFamily: vm.theme.fonts.body, color: c.text },
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    tooltip: { trigger: 'item', valueFormatter: (v) => vm.fmt.eur(Number(v)) },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      inverse: true,
      data: hv.expenses.map((e) => e.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.text, fontSize: fs, width: o.compact ? 130 : 170, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: c.primary, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: c.text, fontSize: fs, formatter: (p: any) => vm.fmt.eur(p.value) },
        data: hv.expenses.map((e) => e.amount),
      },
    ],
  };
}

export function budgetSplitOption(vm: ViewModel, hv: HouseholdView, o: Opts = {}): EChartsOption {
  const c = vm.theme.colors;
  const total = Math.max(hv.summary.income, hv.split.reduce((a, s) => a + s.amount, 0));
  return {
    animation: o.animation ?? true,
    textStyle: { fontFamily: vm.theme.fonts.body, color: c.text },
    grid: { left: 0, right: 0, top: 0, bottom: 30 },
    legend: { bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: c.text, fontSize: o.compact ? 9 : 11 } },
    tooltip: { trigger: 'item', valueFormatter: (v) => vm.fmt.eur(Number(v)) },
    xAxis: { type: 'value', show: false, max: total || 1 },
    yAxis: { type: 'category', show: false, data: [''] },
    series: hv.split.map((s) => ({
      name: s.label,
      type: 'bar' as const,
      stack: 'budget',
      barWidth: o.compact ? 26 : 34,
      itemStyle: { color: s.color, borderColor: '#FFFFFF', borderWidth: 2 },
      label: {
        show: total > 0 && s.amount / total > 0.12,
        color: onColor(s.color),
        fontSize: o.compact ? 9 : 11,
        fontWeight: 600,
        formatter: () => vm.fmt.eur(s.amount),
      },
      data: [s.amount],
    })),
  };
}
