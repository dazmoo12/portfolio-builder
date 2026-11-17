import type { Product } from '../engine/types';
import type { Format, T } from '../i18n';

/** One line describing a product's costs, for the assumptions table of PDF and PowerPoint. */
export function costLine(p: Product, depotFee: number, t: T, fmt: Format): string {
  if (p.kind === 'metal')
    return `${t('entryFee')} ${fmt.pct(p.entryFee ?? 0)} · ${t('annualFee')} ${fmt.pct(p.annualFee ?? 0)} · ${t('exitFee')} ${fmt.pct(p.exitFee ?? 0)}`;
  const front = `${t('frontLoad')} ${fmt.pct(p.entryFee ?? 0)}`;
  if (p.kind === 'avd') return `${front} ${t('frontLoadAvdNote')}`;
  return depotFee > 0 ? `${front} · ${t('depotFeeShort', { fee: fmt.eur(depotFee) })}` : front;
}
