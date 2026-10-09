// Household budget (Haushaltsrechnung): monthly net income and expenses.

export interface BudgetLine {
  id: string;
  /** i18n key for standard categories (e.g. 'inc_salary'); custom lines use `label`. */
  key?: string;
  label?: string;
  /** Monthly amount in €. */
  amount: number;
}

export interface Household {
  income: BudgetLine[];
  expenses: BudgetLine[];
}

export const INCOME_KEYS = ['inc_salary', 'inc_partner', 'inc_childBenefit', 'inc_other'] as const;
export const EXPENSE_KEYS = [
  'exp_housing',
  'exp_utilities',
  'exp_insurance',
  'exp_mobility',
  'exp_living',
  'exp_communication',
  'exp_leisure',
  'exp_savings',
  'exp_loans',
  'exp_other',
] as const;

export interface HouseholdSummary {
  income: number;
  expenses: number;
  /** Income − expenses: what is freely available each month. */
  surplus: number;
  /** Proposed monthly savings of the portfolio. */
  proposed: number;
  /** Surplus left after the proposed savings. */
  reserve: number;
  /** Proposed savings as share of net income. */
  savingsQuota: number;
}

const sum = (lines: BudgetLine[]) => lines.reduce((a, l) => a + (Number.isFinite(l.amount) ? l.amount : 0), 0);

export function summarizeHousehold(h: Household, proposedMonthly: number): HouseholdSummary {
  const income = sum(h.income);
  const expenses = sum(h.expenses);
  const surplus = income - expenses;
  return {
    income,
    expenses,
    surplus,
    proposed: proposedMonthly,
    reserve: surplus - proposedMonthly,
    savingsQuota: income > 0 ? proposedMonthly / income : 0,
  };
}

export function hasHouseholdData(h: Household) {
  return sum(h.income) > 0 || sum(h.expenses) > 0;
}
