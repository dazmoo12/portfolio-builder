// Money journey chart with its key figures – live preview and PDF.

import { useMemo } from 'react';
import { Chart } from '../charts/Chart';
import { journeyOption, type JourneyView } from '../charts/journey';
import type { ViewModel } from '../charts/model';
import { useNarrow } from './useNarrow';

export function journeyNotes(vm: ViewModel, j: JourneyView): string[] {
  const { t } = vm;
  return [
    t('recalcNote'),
    ...(j.waitsForPayout ? [t('journeyWaits', { age: String(j.payoutAge) })] : []),
    ...(j.cutAtPayout ? [t('journeyCut', { age: String(j.payoutAge), end: String(j.contractEndAge) })] : []),
    ...(j.tooLate ? [t('journeyTooLate')] : []),
    t('journeyTaxNote'),
  ];
}

export function JourneyBlock({ vm, j, print = false }: { vm: ViewModel; j: JourneyView; print?: boolean }) {
  const { t, fmt } = vm;
  const narrow = useNarrow() && !print;
  const option = useMemo(() => journeyOption(vm, j, print ? { animation: false, compact: true } : { narrow }), [vm, j, print, narrow]);
  const tot = j.totals;
  return (
    <div className={`journey ${print ? 'print' : ''}`}>
      <div className="journey-meta">
        <b>{j.title}</b> · {t('ageAt')} {j.ages[0]} · {fmt.eur(tot.paidIn)} {t('kpiPaidIn').toLowerCase()} · {fmt.eur(tot.subsidy)}{' '}
        {t('kpiSubsidy').toLowerCase()}
      </div>
      <Chart option={option} height={print ? 300 : 380} renderer={print ? 'svg' : 'canvas'} />
      <div className="journey-kpis">
        <div>
          <span>{t('kpiYouPay')}</span>
          <strong>{fmt.eur(tot.paidIn)}</strong>
        </div>
        <div>
          <span>{t('kpiLump')}</span>
          <strong>{fmt.eur(tot.lumpSum)}</strong>
        </div>
        <div>
          <span>{t('kpiMonthlyTotal', { from: String(j.payoutAge), to: String(j.endAge) })}</span>
          <strong>{fmt.eur(tot.payouts)}</strong>
          <em>
            {j.steps[0] ? `${fmt.eur(j.steps[0].monthly)}${t('perMonth')}` : '–'}
          </em>
        </div>
        <div className="hero">
          <span>{t('kpiTotalOut')}</span>
          <strong>{fmt.eur(tot.total)}</strong>
        </div>
      </div>
      <p className="journey-note">{journeyNotes(vm, j).join(' ')}</p>
    </div>
  );
}
