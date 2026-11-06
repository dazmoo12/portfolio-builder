// Core data model. Everything (UI preview, PDF, PPTX) reads from these types.

export type Lang = 'de' | 'en' | 'pt';
export type Localized = Record<Lang, string>;

export type ScenarioKey = 'pessimistic' | 'neutral' | 'optimistic';
export const SCENARIOS: ScenarioKey[] = ['pessimistic', 'neutral', 'optimistic'];

export type ProductKind = 'avd' | 'fund' | 'metal';
export type ProductGroup = 'pension' | 'riskProfile' | 'fund' | 'metal';

/** One entry of the product catalogue (src/catalog/products.json). */
export interface Product {
  id: string;
  kind: ProductKind;
  group: ProductGroup;
  name: Localized;
  description: Localized;
  /** Expected annual return per scenario, after ongoing fund costs (e.g. 0.05 = 5 %). */
  returns: Record<ScenarioKey, number>;
  /** Historical volatility p.a. for information only. */
  volatility?: number;
  /** One-off cost on every contribution (fund front load, metal purchase markup). */
  entryFee?: number;
  /** Annual cost deducted from the value (metal storage fee). */
  annualFee?: number;
  /** Discount on the value when selling (metal buyback). */
  exitFee?: number;
  /** false = only regular contributions possible (AVD). */
  allowsOneOff: boolean;
  minMonthly?: number;
  minOneOff?: number;
  isin?: string;
  /** Source note shown in the assumptions appendix. */
  source?: string;
}

/** Which adult a personal contract (AVD) belongs to: 'primary' or the id of a further adult. */
export type Owner = string;

/** A product placed in the client's portfolio. */
export interface Position {
  uid: string;
  productId: string;
  /** AVD only: subsidies, starter bonus and payout age depend on the person. */
  owner?: Owner;
  /** First month of the contract (yyyy-mm). */
  start?: string;
  /** Contract term in years. */
  years?: number;
  /** Share of the total monthly savings amount (0..1). */
  monthlyWeight: number;
  /** Share of the total one-off amount (0..1). */
  oneOffWeight: number;
}

export interface Adult {
  id: string;
  name: string;
  age: number;
  birthDate?: string;
}

export interface Child {
  id: string;
  /** ISO date; definitive if known. */
  birthDate?: string;
  /** Used only while no date of birth is known. */
  birthYear?: number;
}

export interface Client {
  name: string;
  /** Age, used only while no date of birth is known. */
  age: number;
  /** Date of birth (ISO). Definitive: the age is derived from it. */
  birthDate?: string;
  /** Children (for the AVD child bonus). */
  children: Child[];
  /** Further adults in the household, e.g. a partner or a grown-up child. */
  adults: Adult[];
  /** Parent who receives the AVD child bonus (each child counts once). */
  childBonusOwner?: Owner;
}

export interface PortfolioInput {
  client: Client;
  /** Timeline of the whole portfolio, derived from the contracts (see syncTimeline). */
  startYear: number;
  horizonYears: number;
  totalMonthly: number;
  totalOneOff: number;
  /** Annual increase of the monthly savings amount (Dynamik), e.g. 0.03. */
  dynamicIncrease: number;
  inflation: number;
  positions: Position[];
}

/** Value of one position at the end of a given year (index 0 = start). */
export interface YearPoint {
  year: number;
  /** Market value before exit fees. */
  value: number;
  /** Value the client would receive when selling (after buyback discount). */
  netValue: number;
  /** Own contributions paid in so far (gross, before fees). */
  paidIn: number;
  /** Government subsidies received so far (AVD). */
  subsidy: number;
  /** Fees paid so far (entry, storage) – informational. */
  fees: number;
}

export interface PositionProjection {
  position: Position;
  product: Product;
  monthly: number;
  oneOff: number;
  series: YearPoint[];
}

export interface ScenarioProjection {
  scenario: ScenarioKey;
  positions: PositionProjection[];
  total: YearPoint[];
}

export type Projection = Record<ScenarioKey, ScenarioProjection>;
