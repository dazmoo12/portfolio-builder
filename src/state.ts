// App state: the portfolio input plus presentation settings. Serialisable as a
// "portfolio file" (save/load) – later the same JSON can come from a CRM.

import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultAdvisor } from './advisors';
import { clientIdByName, getClient, newClientId, saveClient } from './clients';
import { newUid, presetPositions, presets } from './catalog';
import { defaultAssumptions, type Assumptions } from './catalog/assumptions';
import type { Household } from './engine/household';
import { positionTiming, syncTimeline } from './engine/projection';
import type { Adult, Child, Client, Lang, PortfolioInput, ScenarioKey } from './engine/types';

export interface Advisor {
  name: string;
  office: string;
  phone: string;
  email: string;
}

export type ChartId = 'development' | 'allocation' | 'scenarios' | 'composition' | 'journey';

/** Money journey: which money and the payout-phase settings. */
export interface JourneyOutput {
  /** Uid of an AVD position, 'portfolio' for all shown products, 'auto' for the first AVD. */
  target: string;
  lumpSum: number;
  payoutReturn: number;
  endAge: number;
  /** Planned start of payouts, 65 to 70. */
  payoutAge: number;
}

/** What the client output (preview, PDF, PPTX) shows – kept simple for print. */
export interface OutputSettings {
  charts: Record<ChartId, boolean>;
  /** Scenario used for all figures and the development curve. */
  scenario: ScenarioKey;
  /** Also draw the other scenarios as lines in the development curve. */
  showRange: boolean;
  allocationStyle: 'donut' | 'bar';
  journey: JourneyOutput;
  /** Positions switched off by the advisor: figures, charts and exports leave them out. */
  hidden: string[];
}

export const defaultOutput = (): OutputSettings => ({
  charts: { development: true, allocation: true, scenarios: false, composition: true, journey: true },
  scenario: 'neutral',
  showRange: false,
  allocationStyle: 'donut',
  journey: { target: 'auto', lumpSum: 0.3, payoutReturn: 0.04, endAge: 85, payoutAge: 65 },
  hidden: [],
});

export interface AppState {
  version: 1;
  /** Identifies the client in the browser's list of saved clients. */
  clientId: string;
  /** Time of the last change, written into portfolio files to tell older from newer copies. */
  updatedAt?: string;
  /** A new client nothing has been entered for yet; not worth keeping in the list. */
  pristine?: boolean;
  input: PortfolioInput;
  household: Household;
  /** Show the household budget page in preview and exports. */
  includeHousehold: boolean;
  advisor: Advisor;
  /** Editable returns and costs; saved with the portfolio so it always shows the same numbers. */
  assumptions: Assumptions;
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
    clientId: newClientId(),
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
    assumptions: defaultAssumptions(),
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
    pristine: true,
    advisor: defaultAdvisor() ?? prev.advisor,
    output: { ...prev.output, hidden: [], journey: { ...prev.output.journey, target: 'auto' } },
    // the team's values carry over to the next client
    assumptions: prev.assumptions,
    uiLang: prev.uiLang,
    reportLang: prev.reportLang,
    themeId: prev.themeId,
    household: { income: [], expenses: [] },
    input: { ...fresh.input, client: { name: clientName, age: fresh.input.client.age, children: [], adults: [] } },
  };
}

const KEY = 'portfolio-builder.state.v1';
/** Client open in this browser tab, so that every tab keeps its own client on reload. */
const TAB_KEY = 'portfolio-builder.tab-client';

/** Identifies the content of a client; view settings (time slider, nominal/real) are left out. */
export function contentKey(s: AppState): string {
  const { yearIndex, real, updatedAt, pristine, ...content } = s;
  void yearIndex, real, updatedAt, pristine;
  return JSON.stringify(content);
}

/** Clients with a name or with anything entered are kept in the list. */
export function keepClient(s: AppState): boolean {
  return !!s.input.client.name.trim() || !s.pristine;
}

/** Saves the client in the browser's list if worth keeping; returns the time of its last real change. */
export function storeClient(s: AppState): string | undefined {
  return keepClient(s) ? saveClient(s.clientId, s.input.client.name, contentKey(s), s).savedAt : undefined;
}

type OldClient = Partial<Client> & { childrenBirthYears?: number[]; partner?: Omit<Adult, 'id'>; childBonusOwner?: string };

/** Saved clients had one optional partner and children's birth years only. */
function migrateClient(c: OldClient): Client {
  const { childrenBirthYears, partner, childBonusOwner, ...client } = c;
  const known: Child[] = c.children ?? (childrenBirthYears ?? []).map((birthYear) => ({ id: newUid(), birthYear }));
  // the child bonus used to be assigned for all children at once
  const children = known.map((k) => (childBonusOwner && !k.bonusOwner ? { ...k, bonusOwner: childBonusOwner } : k));
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
  const input = migrateInput(s.input);
  return {
    ...d,
    ...s,
    // portfolios from before saved clients: reuse the entry with the same name, if any
    clientId: s.clientId ?? clientIdByName(input.client.name ?? '') ?? d.clientId,
    input,
    household: s.household ?? { income: [], expenses: [] },
    includeHousehold: s.includeHousehold ?? !!s.household,
    output: {
      ...defaultOutput(),
      ...s.output,
      charts: { ...defaultOutput().charts, ...s.output?.charts },
      journey: { ...defaultOutput().journey, ...s.output?.journey },
    },
    assumptions: s.assumptions ?? defaultAssumptions(),
  } as AppState;
}

/** The state as written to a portfolio file: stamped with the time of its last change. */
export function stateForFile(s: AppState): AppState {
  const { pristine, ...rest } = s;
  void pristine;
  return { ...rest, updatedAt: getClient(s.clientId)?.savedAt ?? new Date().toISOString() };
}

/**
 * A portfolio file and this browser's copy of the same client: which one is newer?
 * 'ask' when the file is from before files carried a time and the two differ.
 */
export function newerCopy(file: AppState): { pick: 'file' | 'browser' | 'ask'; browser?: AppState; browserAt?: string } {
  const entry = getClient<AppState>(file.clientId);
  const browser = entry && migrateState(entry.state);
  if (!entry || !browser || entry.key === contentKey(file)) return { pick: 'file' };
  const res = { browser: { ...browser, clientId: entry.id }, browserAt: entry.savedAt };
  if (!file.updatedAt) return { pick: 'ask', ...res };
  return { pick: file.updatedAt >= entry.savedAt ? 'file' : 'browser', ...res };
}

function load(): AppState {
  try {
    // a reloaded tab reopens its own client, not the one last edited in another tab
    const tabClient = sessionStorage.getItem(TAB_KEY);
    const saved = tabClient ? getClient<AppState>(tabClient) : undefined;
    const fromList = saved && migrateState(saved.state);
    if (fromList) return { ...fromList, clientId: saved!.id };
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateState(JSON.parse(raw)) ?? defaultState();
  } catch {
    /* ignore */
  }
  return defaultState();
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);
  /** Time of this tab's last save of the current client (to notice changes from other tabs). */
  const lastSaved = useRef<string>();
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
    try {
      sessionStorage.setItem(TAB_KEY, state.clientId);
    } catch {
      /* storage unavailable */
    }
    lastSaved.current = storeClient(state) ?? lastSaved.current;
  }, [state]);

  const update = useCallback(
    (patch: Partial<AppState>) =>
      setState((s) => {
        // moving the time slider or switching nominal/real is not an entry worth keeping
        const viewOnly = Object.keys(patch).every((k) => ['yearIndex', 'real', 'uiLang', 'reportLang'].includes(k));
        return { ...s, ...patch, pristine: viewOnly ? s.pristine : false };
      }),
    [],
  );
  const updateInput = useCallback(
    (patch: Partial<PortfolioInput>) =>
      setState((s) => {
        const input = syncTimeline({ ...s.input, ...patch });
        // keep the selected year inside the horizon; follow the end when it was at the end
        const atEnd = s.yearIndex >= s.input.horizonYears;
        const yearIndex = atEnd ? input.horizonYears : Math.min(s.yearIndex, input.horizonYears);
        return { ...s, input, yearIndex, pristine: false };
      }),
    [],
  );
  return { state, setState, update, updateInput, lastSaved };
}
