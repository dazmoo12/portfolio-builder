import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from '../charts/Chart';
import type { HouseholdView } from '../charts/household';
import type { ViewModel } from '../charts/model';
import type { Lang } from '../engine/types';
import { allocationOption, compositionOption, developmentOption, scenarioOption } from '../charts/options';
import { catalog } from '../catalog';
import type { Warning } from '../engine/projection';
import type { T } from '../i18n';
import { HouseholdBlock } from './HouseholdBlock';
import { themeVars } from './themeVars';

interface Props {
  vm: ViewModel;
  /** UI-language translator for the controls (vm.t is the output language). */
  ui: T;
  warnings: Warning[];
  household?: HouseholdView;
  uiLang: Lang;
  onYear: (yearIndex: number) => void;
}

export function Preview({ vm, ui, uiLang, warnings, household, onYear }: Props) {
  const { t, fmt } = vm;
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>();
  const yearRef = useRef(vm.yearIndex);
  yearRef.current = vm.yearIndex;

  // "play" animates the time slider through the years
  useEffect(() => {
    if (!playing) return;
    if (yearRef.current >= vm.input.horizonYears) onYear(0);
    timer.current = window.setInterval(() => {
      const next = yearRef.current + 1;
      if (next > vm.input.horizonYears) {
        setPlaying(false);
        return;
      }
      onYear(next);
    }, 180);
    return () => window.clearInterval(timer.current);
  }, [playing, vm.input.horizonYears, onYear]);

  const dev = useMemo(() => developmentOption(vm), [vm]);
  const alloc = useMemo(() => allocationOption(vm), [vm]);
  const comp = useMemo(() => compositionOption(vm), [vm]);
  const scen = useMemo(() => scenarioOption(vm), [vm]);

  const k = vm.kpi;
  const charts = vm.output.charts;
  const scenarioNote = t('scenarioNote', { scenario: t(vm.scenario), rate: fmt.pct(vm.avgReturn) });
  const share = (v: number) => (k.value > 0 ? fmt.pct(v / k.value) : '–');

  return (
    <div className="paper" style={themeVars(vm.theme)}>
      <header className="paper-head">
        <div>
          <div className="kicker">{t('reportKicker')}</div>
          <h1>
            {t('reportTitle')} {vm.input.client.name}
          </h1>
          <div className="meta">
            {t('reportMonthly')} <b>{fmt.eur(vm.input.totalMonthly)}</b> · {t('reportOneOff')}{' '}
            <b>{fmt.eur(vm.input.totalOneOff)}</b> · {vm.real ? t('realHint') : t('nominalHint')}
          </div>
        </div>
        {vm.theme.logo && <img className="logo" src={vm.theme.logo} alt="" />}
      </header>

      {household && (
        <div className="card">
          <h2>{t('householdTitle')}</h2>
          <HouseholdBlock vm={vm} hv={household} />
        </div>
      )}

      <div className="slider-title">
        {t('previewTitle')} <b>{vm.year}</b> · {t('ageAt')} {vm.ageAtYear}
      </div>
      <div className="slider-row">
        <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="yr">{vm.input.startYear}</span>
        <input
          type="range"
          min={0}
          max={vm.input.horizonYears}
          value={vm.yearIndex}
          onChange={(e) => {
            setPlaying(false);
            onYear(Number(e.target.value));
          }}
          aria-label={t('year')}
        />
        <span className="yr">{vm.input.startYear + vm.input.horizonYears}</span>
      </div>

      {warnings.length > 0 && (
        <div className="warnings" role="status">
          {warnings.map((w, i) => (
            <div key={i}>
              ⚠ {w.productId && <b>{catalog[w.productId]?.name[uiLang]}: </b>}
              {ui(`warn_${w.key}`)}
            </div>
          ))}
        </div>
      )}

      <div className="kpis">
        <div className="kpi hero">
          <span>{t('kpiValue')}</span>
          <strong>{fmt.eur(k.value)}</strong>
          <em>
            {vm.output.showRange
              ? `${t('reportScenarioRange')}: ${fmt.eur(k.pessimistic)} – ${fmt.eur(k.optimistic)}`
              : scenarioNote}
          </em>
        </div>
        <div className="kpi">
          <span>{t('kpiPaidIn')}</span>
          <strong>{fmt.eur(k.paidIn)}</strong>
          <em>{share(k.paidIn)}</em>
        </div>
        <div className="kpi">
          <span>{t('kpiSubsidy')}</span>
          <strong>{fmt.eur(k.subsidy)}</strong>
          <em>{share(k.subsidy)}</em>
        </div>
        <div className="kpi">
          <span>{t('kpiGains')}</span>
          <strong>{fmt.eur(k.gains)}</strong>
          <em>{share(k.gains)}</em>
        </div>
      </div>

      {charts.development && (
        <div className="card">
          <h2>
            {t('chartDevelopment')} <span className="sub">· {scenarioNote}</span>
          </h2>
          <Chart option={dev} height={320} />
        </div>
      )}

      {(charts.allocation || charts.scenarios) && (
        <div className={charts.allocation && charts.scenarios ? 'grid2' : ''}>
          {charts.allocation && (
            <div className="card">
              <h2>
                {t('chartAllocation')} {vm.year}
              </h2>
              <Chart option={alloc} height={300} />
            </div>
          )}
          {charts.scenarios && (
            <div className="card">
              <h2>
                {t('chartScenarios')} {vm.year}
              </h2>
              <Chart option={scen} height={300} />
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>
          {charts.composition ? t('chartComposition') : t('reportPositions')} {vm.year}
        </h2>
        {charts.composition && <Chart option={comp} height={Math.max(160, 56 + vm.positions.length * 40)} />}
        <table className="data">
          <thead>
            <tr>
              <th>{t('product')}</th>
              <th>{t('monthly')}</th>
              <th>{t('oneOff')}</th>
              <th>{t('kpiPaidIn')}</th>
              <th>{t('kpiSubsidy')}</th>
              <th>{t('kpiGains')}</th>
              <th>
                {t('value')} {vm.year}
              </th>
            </tr>
          </thead>
          <tbody>
            {vm.positions.map((p) => (
              <tr key={p.uid}>
                <td>
                  <span className="name-cell">
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                  </span>
                </td>
                <td>{fmt.eur(p.monthly)}</td>
                <td>{fmt.eur(p.oneOff)}</td>
                <td>{fmt.eur(p.paidIn)}</td>
                <td>{fmt.eur(p.subsidy)}</td>
                <td>{fmt.eur(p.gains)}</td>
                <td>
                  <b>{fmt.eur(p.value)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="disclaimer">
        {vm.real && t('reportRealNote', { inflation: fmt.pct(vm.input.inflation) }) + ' '}
        {t('disclaimer')}
      </p>
    </div>
  );
}
