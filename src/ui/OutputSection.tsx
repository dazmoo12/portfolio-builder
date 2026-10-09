import { SCENARIOS } from '../engine/types';
import type { T } from '../i18n';
import type { ChartId, OutputSettings } from '../state';
import { Section } from './Settings';

interface Props {
  t: T;
  output: OutputSettings;
  onChange: (o: OutputSettings) => void;
}

const CHARTS: ChartId[] = ['development', 'allocation', 'composition', 'scenarios'];

export function OutputSection({ t, output, onChange }: Props) {
  const set = (patch: Partial<OutputSettings>) => onChange({ ...output, ...patch });
  return (
    <Section title={t('secOutput')}>
      <div className="field">
        <span>{t('displayedScenario')}</span>
        <div className="tabs three" role="radiogroup">
          {SCENARIOS.map((sc) => (
            <button key={sc} role="radio" aria-checked={output.scenario === sc} className={output.scenario === sc ? 'on' : ''} onClick={() => set({ scenario: sc })}>
              {t(sc)}
            </button>
          ))}
        </div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={output.showRange} onChange={(e) => set({ showRange: e.target.checked })} />
        <span>{t('showRange')}</span>
      </label>

      <div className="field">
        <span>{t('chartsShown')}</span>
        {CHARTS.map((id) => (
          <label className="toggle tight" key={id}>
            <input
              type="checkbox"
              checked={output.charts[id]}
              onChange={(e) => set({ charts: { ...output.charts, [id]: e.target.checked } })}
            />
            <span>{t(`chart_${id}`)}</span>
          </label>
        ))}
      </div>

      {output.charts.allocation && (
        <div className="field">
          <span>{t('allocationStyle')}</span>
          <div className="tabs" role="radiogroup">
            {(['donut', 'bar'] as const).map((st) => (
              <button
                key={st}
                role="radio"
                aria-checked={output.allocationStyle === st}
                className={output.allocationStyle === st ? 'on' : ''}
                onClick={() => set({ allocationStyle: st })}
              >
                {t(st === 'donut' ? 'styleDonut' : 'styleBar')}
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
