import { JOURNEY_PORTFOLIO } from '../charts/journey';
import type { T } from '../i18n';
import type { JourneyOutput } from '../state';
import { Section } from './Settings';

interface Props {
  t: T;
  journey: JourneyOutput;
  /** AVD contracts in the portfolio, with their display names. */
  avds: { uid: string; name: string }[];
  onChange: (j: JourneyOutput) => void;
}

const pct = (v: number) => Math.round(v * 1000) / 10;

export function JourneySection({ t, journey, avds, onChange }: Props) {
  const set = (p: Partial<JourneyOutput>) => onChange({ ...journey, ...p });
  const target = journey.target === JOURNEY_PORTFOLIO || avds.some((a) => a.uid === journey.target) ? journey.target : avds[0]?.uid ?? JOURNEY_PORTFOLIO;
  return (
    <Section title={t('secJourney')} defaultOpen={false}>
      <label className="field">
        <span>{t('journeyFor')}</span>
        <select value={target} onChange={(e) => set({ target: e.target.value })}>
          {avds.map((a) => (
            <option key={a.uid} value={a.uid}>
              {a.name}
            </option>
          ))}
          <option value={JOURNEY_PORTFOLIO}>{t('journeyPortfolio')}</option>
        </select>
      </label>
      <div className="row2">
        <label className="field">
          <span>{t('lumpSum')}</span>
          <div className="input-wrap">
            <input
              type="number"
              min={0}
              max={30}
              step={5}
              value={pct(journey.lumpSum)}
              onChange={(e) => set({ lumpSum: Math.min(30, Math.max(0, Number(e.target.value))) / 100 })}
            />
            <em>%</em>
          </div>
        </label>
        <label className="field">
          <span>{t('payoutReturn')}</span>
          <div className="input-wrap">
            <input type="number" step={0.5} value={pct(journey.payoutReturn)} onChange={(e) => set({ payoutReturn: Number(e.target.value) / 100 })} />
            <em>%</em>
          </div>
        </label>
      </div>
      <label className="field">
        <span>{t('payoutEndAge')}</span>
        <input
          type="number"
          min={70}
          max={100}
          value={journey.endAge}
          onChange={(e) => set({ endAge: Math.min(100, Math.max(70, Math.round(Number(e.target.value)))) })}
        />
      </label>
      <p className="hint">{t('recalcNote')}</p>
    </Section>
  );
}
