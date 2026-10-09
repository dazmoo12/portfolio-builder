// Altersvorsorgedepot (AVD) subsidy rules, new business from 1 Jan 2027.
// Source: "Supermontag DB-NO4 Altersvorsorge-Depot 20.07.2026", AVD Info, AVD offers.

export const AVD_RULES = {
  /** Stage 1: 50 % subsidy on the first 360 € of own contributions per year. */
  stage1Limit: 360,
  stage1Rate: 0.5,
  /** Stage 2: 25 % subsidy on own contributions between 360 € and 1,800 €. */
  stage2Limit: 1800,
  stage2Rate: 0.25,
  /** Child bonus: 1 € per € paid in, up to 300 € per child and year. */
  childBonusMax: 300,
  /** Children count while younger than this age. */
  childMaxAge: 25,
  /** One-off starter bonus for savers under 25. */
  starterBonus: 200,
  starterMaxAge: 25,
  /** Maximum own contribution per year. */
  maxAnnualContribution: 6840,
  payoutEarliestAge: 65,
  payoutLatestAge: 70,
  lumpSumShare: 0.3,
} as const;

/** Base subsidy (Grundzulage) for a given annual own contribution. Max 540 €. */
export function baseSubsidy(annualOwn: number): number {
  const r = AVD_RULES;
  const s1 = Math.min(Math.max(annualOwn, 0), r.stage1Limit) * r.stage1Rate;
  const s2 = Math.min(Math.max(annualOwn - r.stage1Limit, 0), r.stage2Limit - r.stage1Limit) * r.stage2Rate;
  return s1 + s2;
}

/** Child bonus for one child in a year: 1:1 on own contributions, capped at 300 €. */
export function childBonus(annualOwn: number): number {
  return Math.min(Math.max(annualOwn, 0), AVD_RULES.childBonusMax);
}

/** Number of children eligible for the child bonus in a calendar year. */
export function eligibleChildren(birthYears: number[], year: number): number {
  return birthYears.filter((b) => year - b >= 0 && year - b < AVD_RULES.childMaxAge).length;
}

export function annualSubsidy(annualOwn: number, birthYears: number[], year: number): number {
  return baseSubsidy(annualOwn) + eligibleChildren(birthYears, year) * childBonus(annualOwn);
}

export function starterBonusApplies(ageAtStart: number): boolean {
  return ageAtStart < AVD_RULES.starterMaxAge;
}
