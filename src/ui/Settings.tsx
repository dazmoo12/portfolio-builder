import { useState } from 'react';
import { catalog, newUid, presetPositions, presets, products } from '../catalog';
import { validateWeights } from '../engine/projection';
import type { Position, ProductGroup } from '../engine/types';
import type { T, Format } from '../i18n';
import type { AppState } from '../state';
import type { Theme } from '../templates/themes';

interface Props {
  state: AppState;
  t: T;
  fmt: Format;
  theme: Theme;
  update: (p: Partial<AppState>) => void;
  updateInput: (p: Partial<AppState['input']>) => void;
}

export function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <button className="section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

export function ClientSection({ state, t, updateInput }: Props) {
  const { client, startYear, horizonYears } = state.input;
  const setClient = (p: Partial<typeof client>) => updateInput({ client: { ...client, ...p } });
  return (
    <Section title={t('secClient')}>
        <label className="field">
          <span>{t('clientName')}</span>
          <input value={client.name} onChange={(e) => setClient({ name: e.target.value })} />
        </label>
        <div className="row2">
          <NumberField label={t('age')} value={client.age} min={0} max={100} onChange={(age) => setClient({ age })} />
          <NumberField label={t('startYear')} value={startYear} min={2025} max={2100} onChange={(v) => updateInput({ startYear: v })} />
        </div>
        <NumberField
          label={t('horizon')}
          value={horizonYears}
          min={1}
          max={60}
          onChange={(v) => updateInput({ horizonYears: Math.min(60, Math.max(1, Math.round(v))) })}
        />
        <div className="field">
          <span>{t('children')}</span>
          <div className="chips">
            {client.childrenBirthYears.map((y, i) => (
              <span className="chip" key={i}>
                <input
                  type="number"
                  value={y}
                  onChange={(e) => {
                    const arr = [...client.childrenBirthYears];
                    arr[i] = Number(e.target.value);
                    setClient({ childrenBirthYears: arr });
                  }}
                />
                <button
                  aria-label={t('remove')}
                  onClick={() => setClient({ childrenBirthYears: client.childrenBirthYears.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </span>
            ))}
            <button className="link" onClick={() => setClient({ childrenBirthYears: [...client.childrenBirthYears, startYear - 1] })}>
              {t('addChild')}
            </button>
          </div>
        </div>
    </Section>
  );
}

export function AmountsSection({ state, t, updateInput }: Props) {
  const i = state.input;
  return (
    <Section title={t('secAmounts')}>
      <div className="row2">
        <NumberField label={t('totalMonthly')} value={i.totalMonthly} step={25} onChange={(v) => updateInput({ totalMonthly: v })} />
        <NumberField label={t('totalOneOff')} value={i.totalOneOff} step={1000} onChange={(v) => updateInput({ totalOneOff: v })} />
      </div>
      <NumberField
        label={t('dynamic')}
        value={Math.round(i.dynamicIncrease * 1000) / 10}
        step={0.5}
        max={10}
        suffix="%"
        onChange={(v) => updateInput({ dynamicIncrease: v / 100 })}
      />
    </Section>
  );
}

export function PresetSection({ state, t, updateInput }: Props) {
  return (
    <Section title={t('secPresets')}>
      <div className="preset-grid">
        {presets.map((p) => (
          <button key={p.id} className="preset" onClick={() => updateInput({ positions: presetPositions(p) })}>
            {p.name[state.uiLang]}
          </button>
        ))}
      </div>
    </Section>
  );
}

const GROUPS: { group: ProductGroup; key: 'groupPension' | 'groupRiskProfile' | 'groupFund' | 'groupMetal' }[] = [
  { group: 'pension', key: 'groupPension' },
  { group: 'riskProfile', key: 'groupRiskProfile' },
  { group: 'fund', key: 'groupFund' },
  { group: 'metal', key: 'groupMetal' },
];

export function PositionsSection({ state, t, fmt, theme, updateInput }: Props) {
  const [tab, setTab] = useState<'monthly' | 'oneOff'>('monthly');
  const i = state.input;
  const key = tab === 'monthly' ? 'monthlyWeight' : 'oneOffWeight';
  const total = tab === 'monthly' ? i.totalMonthly : i.totalOneOff;
  const eligible = (p: Position) => tab === 'monthly' || catalog[p.productId]?.allowsOneOff;
  const check = validateWeights(i, catalog);
  const sum = tab === 'monthly' ? check.monthlySum : check.oneOffSum;
  const ok = Math.abs(sum - 1) < 0.001;

  const setWeight = (uid: string, w: number) =>
    updateInput({ positions: i.positions.map((p) => (p.uid === uid ? { ...p, [key]: Math.max(0, Math.min(1, w)) } : p)) });

  const balance = () => {
    const el = i.positions.filter(eligible);
    const s = el.reduce((a, p) => a + p[key], 0);
    updateInput({
      positions: i.positions.map((p) =>
        !eligible(p) ? p : { ...p, [key]: s > 0 ? Math.round((p[key] / s) * 1000) / 1000 : 1 / el.length },
      ),
    });
  };

  const add = (productId: string) => {
    if (!productId) return;
    updateInput({ positions: [...i.positions, { uid: newUid(), productId, monthlyWeight: 0, oneOffWeight: 0 }] });
  };

  return (
    <Section title={t('secPositions')}>
      <div className="tabs" role="tablist">
        {(['monthly', 'oneOff'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t(k === 'monthly' ? 'tabMonthly' : 'tabOneOff')} · {fmt.eur(k === 'monthly' ? i.totalMonthly : i.totalOneOff)}
          </button>
        ))}
      </div>

      {i.positions.length === 0 && <p className="hint">{t('emptyPortfolio')}</p>}

      <ul className="positions">
        {i.positions.map((p, idx) => {
          const product = catalog[p.productId];
          if (!product) return null;
          const disabled = !eligible(p);
          const w = p[key];
          return (
            <li key={p.uid} className={disabled ? 'disabled' : ''}>
              <div className="pos-head">
                <span className="dot" style={{ background: theme.colors.series[idx] ?? '#8C939D' }} />
                <span className="pos-name" title={product.description[state.uiLang]}>
                  {product.name[state.uiLang]}
                </span>
                <button
                  className="icon"
                  aria-label={t('remove')}
                  title={t('remove')}
                  onClick={() => updateInput({ positions: i.positions.filter((x) => x.uid !== p.uid) })}
                >
                  ×
                </button>
              </div>
              {disabled ? (
                <div className="hint">{t('noOneOff')}</div>
              ) : (
                <div className="pos-controls">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(w * 100)}
                    onChange={(e) => setWeight(p.uid, Number(e.target.value) / 100)}
                    aria-label={product.name[state.uiLang]}
                  />
                  <div className="input-wrap small">
                    <input
                      type="number"
                      value={Math.round(w * 1000) / 10}
                      step={1}
                      onChange={(e) => setWeight(p.uid, Number(e.target.value) / 100)}
                    />
                    <em>%</em>
                  </div>
                  <div className="input-wrap eur">
                    <input
                      type="number"
                      value={Math.round(w * total)}
                      step={tab === 'monthly' ? 5 : 100}
                      onChange={(e) => total > 0 && setWeight(p.uid, Number(e.target.value) / total)}
                    />
                    <em>€</em>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className={`sum ${ok ? 'ok' : 'bad'}`}>
        <span>
          {t('sum')}: {fmt.pct(sum)}
        </span>
        {!ok && i.positions.length > 0 && (
          <button className="link" onClick={balance}>
            {t('balance')}
          </button>
        )}
      </div>

      <select className="add" value="" onChange={(e) => add(e.target.value)}>
        <option value="">{t('addProduct')}</option>
        {GROUPS.map((g) => (
          <optgroup key={g.group} label={t(g.key)}>
            {products
              .filter((p) => p.group === g.group)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name[state.uiLang]}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </Section>
  );
}

export function AssumptionsSection({ state, t, fmt, update, updateInput }: Props) {
  const i = state.input;
  const used = [...new Set(i.positions.map((p) => p.productId))].map((id) => catalog[id]).filter(Boolean);
  return (
    <Section title={t('secAssumptions')} defaultOpen={false}>
      <div className="row2">
        <NumberField
          label={t('inflation')}
          value={Math.round(i.inflation * 1000) / 10}
          step={0.1}
          suffix="%"
          onChange={(v) => updateInput({ inflation: v / 100 })}
        />
        <label className="toggle">
          <input type="checkbox" checked={state.real} onChange={(e) => update({ real: e.target.checked })} />
          <span>{t('showReal')}</span>
        </label>
      </div>
      <table className="assump">
        <thead>
          <tr>
            <th>{t('product')}</th>
            <th title={t('pessimistic')}>{t('pessimistic').slice(0, 4)}.</th>
            <th>{t('neutral')}</th>
            <th title={t('optimistic')}>{t('optimistic').slice(0, 4)}.</th>
          </tr>
        </thead>
        <tbody>
          {used.map((p) => (
            <tr key={p.id} title={p.source}>
              <td>
                {p.name[state.uiLang]}
                {p.kind === 'metal' && (
                  <div className="hint">
                    {t('entryFee')} {fmt.pct(p.entryFee ?? 0)} · {t('annualFee')} {fmt.pct(p.annualFee ?? 0)} · {t('exitFee')}{' '}
                    {fmt.pct(p.exitFee ?? 0)}
                  </div>
                )}
              </td>
              <td>{fmt.pct(p.returns.pessimistic)}</td>
              <td>{fmt.pct(p.returns.neutral)}</td>
              <td>{fmt.pct(p.returns.optimistic)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
