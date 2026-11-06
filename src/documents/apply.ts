// Applying recognised values to the app state.

import { newUid } from '../catalog';
import type { BudgetLine } from '../engine/household';
import { ageOn } from '../engine/person';
import type { Adult, Client } from '../engine/types';
import type { AppState } from '../state';
import type { Candidate } from './extract';
import type { TemplateData } from './template';

/** Sets a budget line by category key (replaces the amount if the category exists). */
function setLine(lines: BudgetLine[], key: string, amount: number): BudgetLine[] {
  return lines.some((l) => l.key === key)
    ? lines.map((l) => (l.key === key ? { ...l, amount } : l))
    : [...lines, { id: newUid(), key, amount }];
}

function addChild(client: Client, birthDate: string): Client {
  const year = Number(birthDate.slice(0, 4));
  if (client.children.some((c) => c.birthDate === birthDate)) return client;
  // a child known by year only gets the exact date
  const sameYear = client.children.find((c) => !c.birthDate && c.birthYear === year);
  const children = sameYear
    ? client.children.map((c) => (c === sameYear ? { ...c, birthDate } : c))
    : [...client.children, { id: newUid(), birthDate }];
  return { ...client, children };
}

export function applyCandidate(s: AppState, c: Candidate): AppState {
  const client = s.input.client;
  const withClient = (next: Client): AppState => ({ ...s, input: { ...s.input, client: next } });
  switch (c.target.type) {
    case 'household': {
      const side = c.target.side;
      return { ...s, household: { ...s.household, [side]: setLine(s.household[side], c.target.key, Number(c.value)) } };
    }
    case 'birthDate': {
      const dated = { birthDate: String(c.value), age: ageOn(String(c.value)) };
      const id = c.target.person;
      if (client.adults.some((a) => a.id === id)) return withClient({ ...client, adults: client.adults.map((a) => (a.id === id ? { ...a, ...dated } : a)) });
      return withClient({ ...client, ...dated });
    }
    case 'childBirth':
      return withClient(addChild(client, String(c.value)));
    case 'name':
      return withClient({ ...client, name: String(c.value) });
  }
}

export function applyTemplate(s: AppState, d: TemplateData): AppState {
  const client = { ...s.input.client };
  if (d.name) client.name = d.name;
  if (d.birthDate) {
    client.birthDate = d.birthDate;
    client.age = ageOn(d.birthDate);
  } else if (d.age) client.age = d.age;
  if (d.children) client.children = d.children.map((c) => ({ ...c, id: newUid() }));
  d.adults.forEach((a, i) => {
    if (!a.name) return;
    const existing: Adult | undefined = client.adults[i];
    const age = a.birthDate ? ageOn(a.birthDate) : a.age ?? existing?.age ?? client.age;
    const adult = { ...existing, id: existing?.id ?? newUid(), name: a.name, age, ...(a.birthDate && { birthDate: a.birthDate }) };
    client.adults = existing ? client.adults.map((x) => (x === existing ? adult : x)) : [...client.adults, adult];
  });
  let { income, expenses } = s.household;
  for (const l of d.household.income) income = setLine(income, l.key!, l.amount);
  for (const l of d.household.expenses) expenses = setLine(expenses, l.key!, l.amount);
  return { ...s, input: { ...s.input, client }, household: { income, expenses } };
}
