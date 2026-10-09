import { newUid } from '../catalog';
import { EXPENSE_KEYS, INCOME_KEYS, summarizeHousehold, type BudgetLine, type Household } from '../engine/household';
import type { Format, T, TKey } from '../i18n';
import type { AppState } from '../state';
import { Section } from './Settings';

interface Props {
  state: AppState;
  t: T;
  fmt: Format;
  update: (p: Partial<AppState>) => void;
}

function Lines({
  lines,
  keys,
  t,
  onChange,
}: {
  lines: BudgetLine[];
  keys: readonly string[];
  t: T;
  onChange: (lines: BudgetLine[]) => void;
}) {
  const used = new Set(lines.map((l) => l.key));
  const set = (id: string, patch: Partial<BudgetLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <>
      {lines.map((l) => (
        <div className="budget-line" key={l.id}>
          {l.key ? (
            <span className="budget-label">{t(l.key as TKey)}</span>
          ) : (
            <input className="budget-label" value={l.label ?? ''} placeholder={t('linePlaceholder')} onChange={(e) => set(l.id, { label: e.target.value })} />
          )}
          <div className="input-wrap eur">
            <input type="number" step={10} min={0} value={l.amount} onChange={(e) => set(l.id, { amount: Number(e.target.value) })} />
            <em>€</em>
          </div>
          <button className="icon" aria-label={t('remove')} title={t('remove')} onClick={() => onChange(lines.filter((x) => x.id !== l.id))}>
            ×
          </button>
        </div>
      ))}
      <select
        className="add"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          onChange([...lines, v === '__custom' ? { id: newUid(), label: '', amount: 0 } : { id: newUid(), key: v, amount: 0 }]);
        }}
      >
        <option value="">{t('addLine')}</option>
        {keys
          .filter((k) => !used.has(k))
          .map((k) => (
            <option key={k} value={k}>
              {t(k as TKey)}
            </option>
          ))}
        <option value="__custom">{t('linePlaceholder')}…</option>
      </select>
    </>
  );
}

export function HouseholdSection({ state, t, fmt, update }: Props) {
  const h = state.household;
  const s = summarizeHousehold(h, state.input.totalMonthly);
  const setH = (patch: Partial<Household>) => update({ household: { ...h, ...patch } });
  return (
    <Section title={t('secHousehold')}>
      <div className="budget-head">
        <span>{t('income')}</span>
        <b>{fmt.eur(s.income)}</b>
      </div>
      <Lines lines={h.income} keys={INCOME_KEYS} t={t} onChange={(income) => setH({ income })} />
      <div className="budget-head">
        <span>{t('expenses')}</span>
        <b>{fmt.eur(s.expenses)}</b>
      </div>
      <Lines lines={h.expenses} keys={EXPENSE_KEYS} t={t} onChange={(expenses) => setH({ expenses })} />
      <div className={`sum ${s.reserve >= 0 ? 'ok' : 'bad'}`}>
        <span>
          {t('kpiSurplus')}: {fmt.eur(s.surplus)}
        </span>
        <span>
          {t('kpiReserve')}: {fmt.eur(s.reserve)}
        </span>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={state.includeHousehold} onChange={(e) => update({ includeHousehold: e.target.checked })} />
        <span>{t('includeHousehold')}</span>
      </label>
    </Section>
  );
}
