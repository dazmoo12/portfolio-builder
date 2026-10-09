// Applying recognised values to the app state.

import { newUid } from '../catalog';
import type { BudgetLine } from '../engine/household';
import type { AppState } from '../state';
import { ageOn, type Candidate } from './extract';
import type { TemplateData } from './template';

/** Sets a budget line by category key (replaces the amount if the category exists). */
function setLine(lines: BudgetLine[], key: string, amount: number): BudgetLine[] {
  return lines.some((l) => l.key === key)
    ? lines.map((l) => (l.key === key ? { ...l, amount } : l))
    : [...lines, { id: newUid(), key, amount }];
}

export function applyCandidate(s: AppState, c: Candidate): AppState {
  const client = s.input.client;
  switch (c.target.type) {
    case 'household': {
      const side = c.target.side;
      return { ...s, household: { ...s.household, [side]: setLine(s.household[side], c.target.key, Number(c.value)) } };
    }
    case 'birthDate':
      return { ...s, input: { ...s.input, client: { ...client, age: ageOn(String(c.value)) } } };
    case 'childBirthYear': {
      const y = Number(c.value);
      if (client.childrenBirthYears.includes(y)) return s;
      return { ...s, input: { ...s.input, client: { ...client, childrenBirthYears: [...client.childrenBirthYears, y].sort() } } };
    }
    case 'name':
      return { ...s, input: { ...s.input, client: { ...client, name: String(c.value) } } };
  }
}

export function applyTemplate(s: AppState, d: TemplateData): AppState {
  const client = { ...s.input.client };
  if (d.name) client.name = d.name;
  if (d.birthDate) client.age = ageOn(d.birthDate);
  else if (d.age) client.age = d.age;
  if (d.childrenBirthYears) client.childrenBirthYears = d.childrenBirthYears;
  let { income, expenses } = s.household;
  for (const l of d.household.income) income = setLine(income, l.key!, l.amount);
  for (const l of d.household.expenses) expenses = setLine(expenses, l.key!, l.amount);
  return { ...s, input: { ...s.input, client }, household: { income, expenses } };
}
