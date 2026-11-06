import { useState } from 'react';
import { catalog, newUid, presetPositions, presets, products } from '../catalog';
import { ageOn, ageToday, childBirthYear, validBirthDate, type Person } from '../engine/person';
import { positionOwner, positionTiming, validateWeights } from '../engine/projection';
import type { Adult, Child, PortfolioInput, Position, ProductGroup } from '../engine/types';
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
  disabled,
  title,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className="field" title={title}>
      <span>{label}</span>
      <div className={`input-wrap ${disabled ? 'readonly' : ''}`}>
        <input
          type="number"
          disabled={disabled}
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

/** Date of birth plus age. With a valid date the age is calculated and read-only. */
function PersonDates({ t, person, onChange }: { t: T; person: Person; onChange: (p: Partial<Person>) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const fixed = validBirthDate(person.birthDate);
  return (
    <div className="row2">
      <label className="field">
        <span>{t('field_birthDate')}</span>
        <input
          type="date"
          min="1900-01-01"
          max={today}
          value={person.birthDate ?? ''}
          onChange={(e) => {
            const birthDate = e.target.value;
            // keep the last valid age, so that clearing the date leaves a sensible value
            onChange(validBirthDate(birthDate) ? { birthDate, age: ageOn(birthDate) } : { birthDate: birthDate || undefined });
          }}
        />
      </label>
      <NumberField
        label={t('age')}
        value={ageToday(person)}
        min={0}
        max={100}
        disabled={fixed}
        title={fixed ? t('ageFromBirthDate') : undefined}
        onChange={(age) => onChange({ age })}
      />
    </div>
  );
}

export function ClientSection({ state, t, updateInput }: Props) {
  const { client } = state.input;
  const setClient = (p: Partial<typeof client>) => updateInput({ client: { ...client, ...p } });
  const setAdult = (id: string, p: Partial<Adult>) => setClient({ adults: client.adults.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const setChild = (id: string, p: Partial<Child>) => setClient({ children: client.children.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const adultLabel = (a: Adult) => a.name || t('secondAdult');
  return (
    <Section title={t('secClient')}>
      <label className="field">
        <span>{t('clientName')}</span>
        <input value={client.name} onChange={(e) => setClient({ name: e.target.value })} />
      </label>
      <PersonDates t={t} person={client} onChange={setClient} />

      {client.adults.map((a) => (
        <div className="partner-box" key={a.id}>
          <div className="pos-head">
            <span className="pos-name">{t('secondAdult')}</span>
            <button
              className="icon"
              aria-label={t('remove')}
              title={t('remove')}
              onClick={() =>
                setClient({
                  adults: client.adults.filter((x) => x.id !== a.id),
                  childBonusOwner: client.childBonusOwner === a.id ? undefined : client.childBonusOwner,
                })
              }
            >
              ×
            </button>
          </div>
          <label className="field">
            <span>{t('clientName')}</span>
            <input value={a.name} onChange={(e) => setAdult(a.id, { name: e.target.value })} />
          </label>
          <PersonDates t={t} person={a} onChange={(p) => setAdult(a.id, p)} />
        </div>
      ))}
      <button className="link align-start" onClick={() => setClient({ adults: [...client.adults, { id: newUid(), name: '', age: client.age }] })}>
        {t('addAdult')}
      </button>

      <div className="field">
        <span>{t('children')}</span>
        {client.children.map((c) => (
          <div className="child-row" key={c.id}>
            <input
              type="date"
              aria-label={t('field_birthDate')}
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              value={c.birthDate ?? ''}
              onChange={(e) => setChild(c.id, { birthDate: e.target.value || undefined })}
            />
            <input
              type="number"
              aria-label={t('childYear')}
              title={t('childYear')}
              placeholder={t('childYear')}
              disabled={validBirthDate(c.birthDate)}
              value={childBirthYear(c) ?? ''}
              onChange={(e) => setChild(c.id, { birthYear: Number(e.target.value) || undefined })}
            />
            <button className="icon" aria-label={t('remove')} title={t('remove')} onClick={() => setClient({ children: client.children.filter((x) => x.id !== c.id) })}>
              ×
            </button>
          </div>
        ))}
        <button className="link align-start" onClick={() => setClient({ children: [...client.children, { id: newUid() }] })}>
          {t('addChild')}
        </button>
      </div>

      {client.adults.length > 0 && client.children.length > 0 && (
        <label className="field">
          <span>{t('childBonusFor')}</span>
          <select value={client.childBonusOwner ?? 'primary'} onChange={(e) => setClient({ childBonusOwner: e.target.value })}>
            <option value="primary">{client.name || t('clientName')}</option>
            {client.adults.map((a) => (
              <option key={a.id} value={a.id}>
                {adultLabel(a)}
              </option>
            ))}
          </select>
        </label>
      )}
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
          <button key={p.id} className="preset" onClick={() => updateInput({ positions: presetPositions(p, nextTiming(state.input)) })}>
            {p.name[state.uiLang]}
          </button>
        ))}
      </div>
    </Section>
  );
}

/** New products start with the timing of the first contract. */
function nextTiming(input: PortfolioInput) {
  const first = input.positions[0];
  return {
    start: first?.start ?? `${input.startYear}-01`,
    years: first ? positionTiming(input, first).years : input.horizonYears,
  };
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

  const setPosition = (uid: string, p: Partial<Position>) => updateInput({ positions: i.positions.map((x) => (x.uid === uid ? { ...x, ...p } : x)) });

  const add = (productId: string) => {
    if (!productId) return;
    updateInput({ positions: [...i.positions, { uid: newUid(), productId, monthlyWeight: 0, oneOffWeight: 0, ...nextTiming(i) }] });
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
              {product.kind === 'avd' && i.client.adults.length > 0 && (
                <label className="owner">
                  <span>{t('avdOwner')}</span>
                  <select value={positionOwner(i.client, p)} onChange={(e) => setPosition(p.uid, { owner: e.target.value })}>
                    <option value="primary">{i.client.name || t('clientName')}</option>
                    {i.client.adults.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || t('secondAdult')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="pos-timing">
                <label className="field">
                  <span>{t('reportStart')}</span>
                  <input
                    type="month"
                    value={p.start ?? ''}
                    // an unfinished entry is empty: keep the last complete month
                    onChange={(e) => e.target.value && setPosition(p.uid, { start: e.target.value })}
                  />
                </label>
                <NumberField
                  label={t('horizon')}
                  value={positionTiming(i, p).years}
                  min={1}
                  max={60}
                  onChange={(v) => setPosition(p.uid, { years: Math.min(60, Math.max(1, Math.round(v))) })}
                />
              </div>
              {i.positions.length > 1 && (
                <button className="link" onClick={() => updateInput({ positions: i.positions.map((x) => ({ ...x, start: p.start, years: p.years })) })}>
                  {t('applyTimingAll')}
                </button>
              )}
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
