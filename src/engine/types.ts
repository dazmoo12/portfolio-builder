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

/** A product placed in the client's portfolio. */
export interface Position {
  uid: string;
  productId: string;
  /** Share of the total monthly savings amount (0..1). */
  monthlyWeight: number;
  /** Share of the total one-off amount (0..1). */
  oneOffWeight: number;
}

export interface Client {
  name: string;
  /** Age at start of the investment. */
  age: number;
  /** Birth years of children (for the AVD child bonus). */
  childrenBirthYears: number[];
}

export interface PortfolioInput {
  client: Client;
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
