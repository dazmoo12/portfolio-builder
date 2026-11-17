// Editable return assumptions and costs. The catalogue holds the standard values; the team's
// changes are stored as overrides, travel with each saved portfolio and can be shared as a file.

import type { Catalog } from '../engine/projection';
import { SCENARIOS, type ScenarioKey } from '../engine/types';
import { catalog as baseCatalog, defaultDepotFee } from './index';

export interface ProductOverride {
  returns?: Partial<Record<ScenarioKey, number>>;
  /** Front load on each payment (funds, AVD) or purchase markup (metals). */
  entryFee?: number;
  /** Storage fee p.a. (metals). */
  annualFee?: number;
  /** Buyback discount (metals). */
  exitFee?: number;
}

export interface Assumptions {
  products: Record<string, ProductOverride>;
  /** Brokerage account fee in € p.a., charged once per client depot for all fund products. */
  depotFee: number;
}

export const defaultAssumptions = (): Assumptions => ({ products: {}, depotFee: defaultDepotFee });

export function applyAssumptions(base: Catalog, a: Assumptions): Catalog {
  return Object.fromEntries(
    Object.entries(base).map(([id, p]) => {
      const o = a.products[id];
      if (!o) return [id, p];
      return [id, { ...p, ...o, returns: { ...p.returns, ...o.returns } }];
    }),
  );
}

type CostKey = 'entryFee' | 'annualFee' | 'exitFee';

/** Sets one value; a value equal to the standard removes the override again. */
export function setOverride(a: Assumptions, id: string, change: { scenario: ScenarioKey; value: number } | { cost: CostKey; value: number }): Assumptions {
  const base = baseCatalog[id];
  const o: ProductOverride = { ...a.products[id], returns: { ...a.products[id]?.returns } };
  if ('scenario' in change) {
    if (Math.abs(base.returns[change.scenario] - change.value) < 1e-9) delete o.returns![change.scenario];
    else o.returns![change.scenario] = change.value;
  } else if (Math.abs((base[change.cost] ?? 0) - change.value) < 1e-9) delete o[change.cost];
  else o[change.cost] = change.value;
  if (o.returns && Object.keys(o.returns).length === 0) delete o.returns;
  const products = { ...a.products, [id]: o };
  if (Object.keys(o).length === 0) delete products[id];
  return { ...a, products };
}

export function resetProduct(a: Assumptions, id: string, part: 'returns' | 'costs'): Assumptions {
  const o = { ...a.products[id] };
  if (part === 'returns') delete o.returns;
  else for (const k of ['entryFee', 'annualFee', 'exitFee'] as const) delete o[k];
  const products = { ...a.products, [id]: o };
  if (Object.keys(o).length === 0) delete products[id];
  return { ...a, products };
}

export const hasReturnOverride = (a: Assumptions, id: string) => !!a.products[id]?.returns;
export const hasCostOverride = (a: Assumptions, id: string) =>
  (['entryFee', 'annualFee', 'exitFee'] as const).some((k) => a.products[id]?.[k] !== undefined);

const FILE_TYPE = 'portfolio-builder-assumptions';

export const assumptionsFile = (a: Assumptions) => JSON.stringify({ type: FILE_TYPE, version: 1, assumptions: a }, null, 2);

const isRate = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > -1 && v < 1;

/** Reads a shared file; unknown products and implausible values are dropped. */
export function readAssumptionsFile(raw: unknown): Assumptions | null {
  const f = raw as { type?: string; assumptions?: Partial<Assumptions> };
  if (f?.type !== FILE_TYPE || !f.assumptions) return null;
  const products: Record<string, ProductOverride> = {};
  for (const [id, o] of Object.entries(f.assumptions.products ?? {})) {
    if (!baseCatalog[id] || !o) continue;
    const clean: ProductOverride = {};
    const returns = Object.fromEntries(SCENARIOS.filter((s) => isRate(o.returns?.[s])).map((s) => [s, o.returns![s]]));
    if (Object.keys(returns).length) clean.returns = returns;
    for (const k of ['entryFee', 'annualFee', 'exitFee'] as const) if (isRate(o[k]) && o[k]! >= 0) clean[k] = o[k];
    if (Object.keys(clean).length) products[id] = clean;
  }
  const fee = f.assumptions.depotFee;
  return { products, depotFee: typeof fee === 'number' && fee >= 0 && fee < 10_000 ? fee : defaultDepotFee };
}
