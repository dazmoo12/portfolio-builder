// Print layout (A4) used for the PDF export. Same charts as the live preview,
// rendered as SVG without animation so they stay sharp in the PDF.

import { Chart } from '../charts/Chart';
import type { HouseholdView } from '../charts/household';
import type { ViewModel } from '../charts/model';
import { allocationOption, compositionOption, developmentOption, scenarioOption } from '../charts/options';
import type { Advisor } from '../state';
import { HouseholdBlock } from '../ui/HouseholdBlock';
import { themeVars } from '../ui/themeVars';

const print = { animation: false, compact: true };

export function Report({ vm, advisor, household }: { vm: ViewModel; advisor: Advisor; household?: HouseholdView }) {
  const { t, fmt, input } = vm;
  const k = vm.kpi;
  const share = (v: number) => (k.value > 0 ? fmt.pct(v / k.value) : '–');
  const charts = vm.output.charts;
  const scenarioNote = t('scenarioNote', { scenario: t(vm.scenario), rate: fmt.pct(vm.avgReturn) });

  const pageOffset = household ? 1 : 0;
  const footer = (page: number) => (
    <footer className="r-footer">
      <span>
        {advisor.office} · {advisor.name} · {advisor.phone} · {advisor.email}
      </span>
      <span>
        {t('reportPage')} {page + pageOffset}
      </span>
    </footer>
  );

  return (
    <div className="report" style={themeVars(vm.theme)}>
      {/* Optional first page – household budget */}
      {household && (
        <section className="r-page">
          <header className="r-head">
            <div>
              <div className="kicker">{t('reportKicker')}</div>
              <h1>{t('householdTitle')}</h1>
            </div>
            {vm.theme.logo && <img className="logo" src={vm.theme.logo} alt="" />}
          </header>
          <div className="r-meta">
            <span>
              <b>{input.client.name}</b>
            </span>
            <span>
              {t('age')} <b>{input.client.age}</b>
            </span>
          </div>
          <HouseholdBlock vm={vm} hv={household} print />
          {footer(1 - pageOffset)}
        </section>
      )}
      {/* Page 1 – overview */}
      <section className="r-page">
        <header className="r-head">
          <div>
            <div className="kicker">{t('reportKicker')}</div>
            <h1>
              {t('reportTitle')} {input.client.name}
            </h1>
          </div>
          {vm.theme.logo && <img className="logo" src={vm.theme.logo} alt="" />}
        </header>
        <div className="r-meta">
          <span>
            {t('age')} <b>{input.client.age}</b>
          </span>
          <span>
            {t('reportStart')} <b>{input.startYear}</b>
          </span>
          <span>
            {t('reportDuration')} <b>{input.horizonYears} {t('reportYears')}</b>
          </span>
          <span>
            {t('reportMonthly')} <b>{fmt.eur(input.totalMonthly)}</b>
          </span>
          <span>
            {t('reportOneOff')} <b>{fmt.eur(input.totalOneOff)}</b>
          </span>
        </div>

        <div className="r-hero">
          <div>
            <div className="r-hero-label">
              {t('reportEndValue', { years: String(vm.yearIndex) })} ({vm.year} · {t('ageAt')} {vm.ageAtYear})
            </div>
            <div className="r-hero-value">{fmt.eur(k.value)}</div>
            <div className="r-hero-sub">
              {vm.output.showRange
                ? `${t('reportScenarioRange')}: ${fmt.eur(k.pessimistic)} – ${fmt.eur(k.optimistic)}`
                : scenarioNote}
            </div>
          </div>
          <div className="r-hero-kpis">
            <div>
              <span>{t('kpiPaidIn')}</span>
              <b>{fmt.eur(k.paidIn)}</b>
              <em>{share(k.paidIn)}</em>
            </div>
            <div>
              <span>{t('kpiSubsidy')}</span>
              <b>{fmt.eur(k.subsidy)}</b>
              <em>{share(k.subsidy)}</em>
            </div>
            <div>
              <span>{t('kpiGains')}</span>
              <b>{fmt.eur(k.gains)}</b>
              <em>{share(k.gains)}</em>
            </div>
          </div>
        </div>

        <div className={charts.allocation ? 'r-grid' : ''}>
          {charts.allocation && (
            <div className="r-card">
              <h2>
                {t('chartAllocation')} {vm.year}
              </h2>
              <Chart option={allocationOption(vm, print)} height={250} renderer="svg" />
            </div>
          )}
          <div className="r-card">
            <h2>{t('reportPositions')}</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('monthly')}</th>
                  <th>{t('oneOff')}</th>
                  <th>{vm.year}</th>
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
                    <td>
                      <b>{fmt.eur(p.value)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {charts.composition && (
          <div className="r-card">
            <h2>
              {t('chartComposition')} {vm.year}
            </h2>
            <Chart option={compositionOption(vm, print)} height={Math.max(150, 50 + vm.positions.length * 32)} renderer="svg" />
          </div>
        )}
        {footer(1)}
      </section>

      {/* Page 2 – development, scenarios, assumptions */}
      <section className="r-page">
        {charts.development && (
          <div className="r-card">
            <h2>
              {t('chartDevelopment')} <span className="r-sub">· {scenarioNote}</span>
            </h2>
            <Chart option={developmentOption(vm, print)} height={300} renderer="svg" />
          </div>
        )}
        {(charts.scenarios || vm.hasAvd) && (
          <div className={charts.scenarios && vm.hasAvd ? 'r-grid' : ''}>
            {charts.scenarios && (
              <div className="r-card">
                <h2>
                  {t('chartScenarios')} {vm.year}
                </h2>
                <Chart option={scenarioOption(vm, print)} height={210} renderer="svg" />
              </div>
            )}
            {vm.hasAvd && (
              <div className="r-card r-note">
                <h2>{t('reportAvdTitle')}</h2>
                <p>{t('reportAvdText')}</p>
              </div>
            )}
          </div>
        )}

        <div className="r-card">
          <h2>{t('reportAssumptions')}</h2>
          <table className="data">
            <thead>
              <tr>
                <th>{t('product')}</th>
                <th>{t('pessimistic')}</th>
                <th>{t('neutral')}</th>
                <th>{t('optimistic')}</th>
              </tr>
            </thead>
            <tbody>
              {vm.positions.map((p) => (
                <tr key={p.uid}>
                  <td>
                    {p.name}
                    {p.product.kind === 'metal' && (
                      <div className="small muted">
                        {t('entryFee')} {fmt.pct(p.product.entryFee ?? 0)} · {t('annualFee')} {fmt.pct(p.product.annualFee ?? 0)} ·{' '}
                        {t('exitFee')} {fmt.pct(p.product.exitFee ?? 0)}
                      </div>
                    )}
                  </td>
                  <td>{fmt.pct(p.product.returns.pessimistic)}</td>
                  <td>{fmt.pct(p.product.returns.neutral)}</td>
                  <td>{fmt.pct(p.product.returns.optimistic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="r-contact">
          <div className="kicker">{t('reportContact')}</div>
          <div className="r-contact-name">{advisor.name}</div>
          <div>
            {advisor.office} · {advisor.phone} · {advisor.email}
          </div>
        </div>

        <p className="disclaimer">
          {vm.real && t('reportRealNote', { inflation: fmt.pct(input.inflation) }) + ' '}
          {t('disclaimer')}
        </p>
        {footer(2)}
      </section>
    </div>
  );
}
