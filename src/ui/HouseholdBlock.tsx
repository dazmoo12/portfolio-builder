// Household budget page content – used in the live preview and as first page of the PDF.

import { useMemo } from 'react';
import { Chart } from '../charts/Chart';
import { budgetSplitOption, expensesOption, type HouseholdView } from '../charts/household';
import type { ViewModel } from '../charts/model';

interface Props {
  vm: ViewModel;
  hv: HouseholdView;
  /** Print mode: SVG charts, no animation, smaller sizes. */
  print?: boolean;
}

export function HouseholdBlock({ vm, hv, print = false }: Props) {
  const { t, fmt } = vm;
  const s = hv.summary;
  const opts = print ? { animation: false, compact: true } : {};
  const renderer = print ? 'svg' : 'canvas';
  const split = useMemo(() => budgetSplitOption(vm, hv, opts), [vm, hv, print]); // eslint-disable-line react-hooks/exhaustive-deps
  const expenses = useMemo(() => expensesOption(vm, hv, opts), [vm, hv, print]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`household ${print ? 'print' : ''}`}>
      <div className="hh-kpis">
        <div className="hh-kpi">
          <span>{t('kpiIncome')}</span>
          <strong>{fmt.eur(s.income)}</strong>
        </div>
        <div className="hh-op">−</div>
        <div className="hh-kpi">
          <span>{t('kpiExpenses')}</span>
          <strong>{fmt.eur(s.expenses)}</strong>
        </div>
        <div className="hh-op">=</div>
        <div className="hh-kpi strong">
          <span>{t('kpiSurplus')}</span>
          <strong>{fmt.eur(s.surplus)}</strong>
        </div>
        <div className="hh-kpi hero">
          <span>{t('kpiProposed')}</span>
          <strong>{fmt.eur(s.proposed)}</strong>
          <em>
            {t('savingsQuota')} {fmt.pct(s.savingsQuota)} · {t('kpiReserve')} {fmt.eur(s.reserve)}
          </em>
        </div>
      </div>

      <div className="hh-split">
        <h3>{t('chartBudgetSplit')}</h3>
        <Chart option={split} height={print ? 64 : 76} renderer={renderer} />
      </div>

      <div className="hh-cols">
        <div>
          <h3>{t('chartExpenses')}</h3>
          <Chart option={expenses} height={Math.max(120, hv.expenses.length * (print ? 24 : 30) + 10)} renderer={renderer} />
        </div>
        <div>
          <h3>{t('income')}</h3>
          <table className="data">
            <tbody>
              {hv.income.map((l, i) => (
                <tr key={i}>
                  <td>{l.label}</td>
                  <td>{fmt.eur(l.amount)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>{t('kpiIncome')}</td>
                <td>{fmt.eur(s.income)}</td>
              </tr>
            </tbody>
          </table>
          <p className="hh-note">{t('householdNote')}</p>
        </div>
      </div>
    </div>
  );
}
