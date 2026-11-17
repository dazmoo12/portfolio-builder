import { useRef, useState } from 'react';
import {
  assumptionsFile,
  defaultAssumptions,
  hasCostOverride,
  hasReturnOverride,
  readAssumptionsFile,
  resetProduct,
  setOverride,
  type Assumptions,
} from '../catalog/assumptions';
import { products as allProducts } from '../catalog';
import type { Catalog } from '../engine/projection';
import { SCENARIOS, type Product } from '../engine/types';
import type { Format, T } from '../i18n';
import type { AppState } from '../state';
import { Section } from './Settings';

interface Props {
  state: AppState;
  t: T;
  fmt: Format;
  /** Catalogue with the current overrides applied. */
  products: Catalog;
  update: (p: Partial<AppState>) => void;
  updateInput: (p: Partial<AppState['input']>) => void;
}

const toPct = (v: number | undefined) => Math.round((v ?? 0) * 10000) / 100;

function Pct({ label, value, onChange, step = 0.1 }: { label: string; value: number | undefined; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="mini">
      <span>{label}</span>
      <div className="input-wrap">
        <input type="number" step={step} value={toPct(value)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
        <em>%</em>
      </div>
    </label>
  );
}

/** Products in the portfolio, or all of them. */
function useProductList(state: AppState, products: Catalog, showAll: boolean): Product[] {
  const used = new Set(state.input.positions.map((p) => p.productId));
  return allProducts.filter((p) => showAll || used.has(p.id)).map((p) => products[p.id]);
}

function ShowAll({ t, value, onChange }: { t: T; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle tight">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{t('showAllProducts')}</span>
    </label>
  );
}

export function AssumptionsSection({ state, t, products, update, updateInput }: Props) {
  const [showAll, setShowAll] = useState(false);
  const a = state.assumptions;
  const set = (next: Assumptions) => update({ assumptions: next });
  const list = useProductList(state, products, showAll);
  const i = state.input;
  return (
    <Section title={t('secAssumptions')} defaultOpen={false}>
      <div className="row2">
        <label className="field">
          <span>{t('inflation')}</span>
          <div className="input-wrap">
            <input type="number" step={0.1} value={toPct(i.inflation)} onChange={(e) => updateInput({ inflation: Number(e.target.value) / 100 })} />
            <em>%</em>
          </div>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={state.real} onChange={(e) => update({ real: e.target.checked })} />
          <span>{t('showReal')}</span>
        </label>
      </div>
      <p className="hint">
        {t('returnPa')} · {t('returnsNetNote')}
      </p>
      {list.map((p) => (
        <div className="assump-row" key={p.id}>
          <div className="assump-name">
            <span title={p.source}>{p.name[state.uiLang]}</span>
            {hasReturnOverride(a, p.id) && (
              <button className="link" onClick={() => set(resetProduct(a, p.id, 'returns'))} title={t('resetDefaults')}>
                ↺ {t('standard')}
              </button>
            )}
          </div>
          <div className="mini-grid">
            {SCENARIOS.map((sc) => (
              <Pct key={sc} label={t(sc)} value={p.returns[sc]} onChange={(value) => set(setOverride(a, p.id, { scenario: sc, value }))} />
            ))}
          </div>
        </div>
      ))}
      <ShowAll t={t} value={showAll} onChange={setShowAll} />
      {list.length === 0 && <p className="hint">{t('emptyPortfolio')}</p>}
    </Section>
  );
}

function download(name: string, content: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function CostsSection({ state, t, fmt, products, update }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [msg, setMsg] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const a = state.assumptions;
  const set = (next: Assumptions) => update({ assumptions: next });
  const list = useProductList(state, products, showAll);
  const cost = (p: Product, key: 'entryFee' | 'annualFee' | 'exitFee', value: number) => set(setOverride(a, p.id, { cost: key, value }));

  return (
    <Section title={t('secCosts')} defaultOpen={false}>
      <label className="field">
        <span>{t('depotFee')}</span>
        <div className="input-wrap">
          <input type="number" min={0} step={1} value={a.depotFee} onChange={(e) => set({ ...a, depotFee: Math.max(0, Number(e.target.value)) })} />
          <em>€</em>
        </div>
      </label>
      {list.map((p) => (
        <div className="assump-row" key={p.id}>
          <div className="assump-name">
            <span>{p.name[state.uiLang]}</span>
            {hasCostOverride(a, p.id) && (
              <button className="link" onClick={() => set(resetProduct(a, p.id, 'costs'))} title={t('resetDefaults')}>
                ↺ {t('standard')}
              </button>
            )}
          </div>
          {p.kind === 'metal' ? (
            <div className="mini-grid">
              <Pct label={t('entryFee')} value={p.entryFee} onChange={(v) => cost(p, 'entryFee', v)} />
              <Pct label={t('annualFee')} value={p.annualFee} onChange={(v) => cost(p, 'annualFee', v)} step={0.01} />
              <Pct label={t('exitFee')} value={p.exitFee} onChange={(v) => cost(p, 'exitFee', v)} />
            </div>
          ) : (
            <div className="mini-grid">
              <Pct label={t('frontLoad')} value={p.entryFee} onChange={(v) => cost(p, 'entryFee', v)} />
              <span className="hint mini-note">{p.kind === 'avd' ? t('frontLoadAvdNote') : t('frontLoadFundNote')}</span>
            </div>
          )}
        </div>
      ))}
      <ShowAll t={t} value={showAll} onChange={setShowAll} />
      <p className="hint">{t('costsNote', { fee: fmt.eur(a.depotFee) })}</p>
      <div className="upload-row">
        <button className="btn ghost" onClick={() => download('Annahmen_und_Kosten.json', assumptionsFile(a))}>
          {t('exportAssumptions')}
        </button>
        <button className="btn ghost" onClick={() => fileInput.current?.click()}>
          {t('importAssumptions')}
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            set(defaultAssumptions());
            setMsg('');
          }}
        >
          {t('resetDefaults')}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const read = readAssumptionsFile(JSON.parse(await f.text()));
            if (!read) throw new Error();
            set(read);
            setMsg(t('assumptionsImported', { name: f.name }));
          } catch {
            setMsg(t('invalidFile'));
          }
        }}
      />
      {msg && <div className="hint ok-text">{msg}</div>}
    </Section>
  );
}
