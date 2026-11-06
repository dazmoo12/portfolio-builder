// App state: the portfolio input plus presentation settings. Serialisable as a
// "portfolio file" (save/load) – later the same JSON can come from a CRM.

import { useCallback, useEffect, useState } from 'react';
import { defaultAdvisor } from './advisors';
import { newUid, presetPositions, presets } from './catalog';
import type { Household } from './engine/household';
import { positionTiming, syncTimeline } from './engine/projection';
import type { Adult, Child, Client, Lang, PortfolioInput, ScenarioKey } from './engine/types';

export interface Advisor {
  name: string;
  office: string;
  phone: string;
  email: string;
}

export type ChartId = 'development' | 'allocation' | 'scenarios' | 'composition';

/** What the client output (preview, PDF, PPTX) shows – kept simple for print. */
export interface OutputSettings {
  charts: Record<ChartId, boolean>;
  /** Scenario used for all figures and the development curve. */
  scenario: ScenarioKey;
  /** Also draw the other scenarios as lines in the development curve. */
  showRange: boolean;
  allocationStyle: 'donut' | 'bar';
  /** Positions switched off by the advisor: figures, charts and exports leave them out. */
  hidden: string[];
}

export const defaultOutput = (): OutputSettings => ({
  charts: { development: true, allocation: true, scenarios: false, composition: true },
  scenario: 'neutral',
  showRange: false,
  allocationStyle: 'donut',
  hidden: [],
});

export interface AppState {
  version: 1;
  input: PortfolioInput;
  household: Household;
  /** Show the household budget page in preview and exports. */
  includeHousehold: boolean;
  advisor: Advisor;
  output: OutputSettings;
  uiLang: Lang;
  reportLang: Lang;
  themeId: string;
  real: boolean;
  /** Selected year index for the time slider (0 = start). */
  yearIndex: number;
}

const firstYear = Math.max(new Date().getFullYear() + 1, 2027);

export function defaultState(): AppState {
  return {
    version: 1,
    input: {
      // fictional demo client
      client: { name: 'Anna Beispiel', age: 32, birthDate: '1994-03-15', children: [{ id: 'c1', birthDate: '2021-06-10' }], adults: [] },
      startYear: firstYear,
      horizonYears: 35,
      totalMonthly: 300,
      totalOneOff: 10000,
      dynamicIncrease: 0,
      inflation: 0.02,
      positions: presetPositions(presets.find((p) => p.id === 'balance')!, { start: `${firstYear}-01`, years: 35 }),
    },
    // fictional demo household
    household: {
      income: [
        { id: 'i1', key: 'inc_salary', amount: 3200 },
        { id: 'i2', key: 'inc_childBenefit', amount: 255 },
      ],
      expenses: [
        { id: 'e1', key: 'exp_housing', amount: 1100 },
        { id: 'e2', key: 'exp_utilities', amount: 220 },
        { id: 'e3', key: 'exp_insurance', amount: 180 },
        { id: 'e4', key: 'exp_mobility', amount: 250 },
        { id: 'e5', key: 'exp_living', amount: 650 },
        { id: 'e6', key: 'exp_communication', amount: 60 },
        { id: 'e7', key: 'exp_leisure', amount: 200 },
      ],
    },
    includeHousehold: true,
    advisor: defaultAdvisor() ?? { name: 'Max Mustermann', office: 'Vermögensberatung Musterstadt', phone: '+49 30 000000', email: 'max.mustermann@example.com' },
    output: defaultOutput(),
    uiLang: 'de',
    reportLang: 'de',
    themeId: 'classic',
    real: false,
    yearIndex: 35,
  };
}

/**
 * A clean state for the next client: keeps the advisor (or the saved default) and the
 * presentation settings, never data of the previous client.
 */
export function newClientState(prev: AppState, clientName = ''): AppState {
  const fresh = defaultState();
  return {
    ...fresh,
    advisor: defaultAdvisor() ?? prev.advisor,
    output: { ...prev.output, hidden: [] },
    uiLang: prev.uiLang,
    reportLang: prev.reportLang,
    themeId: prev.themeId,
    household: { income: [], expenses: [] },
    input: { ...fresh.input, client: { name: clientName, age: fresh.input.client.age, children: [], adults: [] } },
  };
}

const KEY = 'portfolio-builder.state.v1';

type OldClient = Partial<Client> & { childrenBirthYears?: number[]; partner?: Omit<Adult, 'id'> };

/** Saved clients had one optional partner and children's birth years only. */
function migrateClient(c: OldClient): Client {
  const { childrenBirthYears, partner, ...client } = c;
  const children: Child[] = c.children ?? (childrenBirthYears ?? []).map((birthYear) => ({ id: newUid(), birthYear }));
  // the id 'partner' keeps saved AVD assignments valid
  const adults: Adult[] = c.adults ?? (partner ? [{ ...partner, id: 'partner' }] : []);
  return { ...client, children, adults } as Client;
}

/** Saved portfolios had one start and duration for all products. */
function migrateInput(input: PortfolioInput): PortfolioInput {
  const client = migrateClient(input.client as OldClient);
  const positions = input.positions.map((p) => {
    const t = positionTiming(input, p);
    return { ...p, start: p.start ?? `${t.year}-01`, years: t.years };
  });
  return syncTimeline({ ...input, client, positions });
}

/** Accepts saved states/files from older prototype versions by filling in missing fields. */
export function migrateState(raw: unknown): AppState | null {
  const s = raw as Partial<AppState>;
  if (!s || s.version !== 1 || !s.input?.positions) return null;
  const d = defaultState();
  return {
    ...d,
    ...s,
    input: migrateInput(s.input),
    household: s.household ?? { income: [], expenses: [] },
    includeHousehold: s.includeHousehold ?? !!s.household,
    output: { ...defaultOutput(), ...s.output, charts: { ...defaultOutput().charts, ...s.output?.charts } },
  } as AppState;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateState(JSON.parse(raw)) ?? defaultState();
  } catch {
    /* ignore */
  }
  return defaultState();
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  const update = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const updateInput = useCallback(
    (patch: Partial<PortfolioInput>) =>
      setState((s) => {
        const input = syncTimeline({ ...s.input, ...patch });
        // keep the selected year inside the horizon; follow the end when it was at the end
        const atEnd = s.yearIndex >= s.input.horizonYears;
        const yearIndex = atEnd ? input.horizonYears : Math.min(s.yearIndex, input.horizonYears);
        return { ...s, input, yearIndex };
      }),
    [],
  );
  return { state, setState, update, updateInput };
}
