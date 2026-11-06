// Ages of the adults. A date of birth is definitive: if one is known, the age is always
// derived from it; the plain age field only applies while no date is entered.

export interface Person {
  age: number;
  /** ISO date (yyyy-mm-dd). */
  birthDate?: string;
}

/** Age in full years on a given date. */
export function ageOn(birthIso: string, on = new Date()): number {
  const [y, m, d] = birthIso.split('-').map(Number);
  const beforeBirthday = on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d);
  return on.getFullYear() - y - (beforeBirthday ? 1 : 0);
}

/** False for empty, half-typed (year 0199) and future dates. */
export function validBirthDate(iso: string | undefined, today = new Date()): iso is string {
  const m = iso?.match(/^(\d{4})-\d{2}-\d{2}$/);
  return !!m && Number(m[1]) >= 1900 && ageOn(iso!, today) >= 0;
}

export function ageToday(p: Person, today = new Date()): number {
  return validBirthDate(p.birthDate, today) ? ageOn(p.birthDate, today) : p.age;
}

/** Age when the investment starts (1 January of the start year); the projection counts from here. */
export function ageAtStart(p: Person, startYear: number): number {
  return validBirthDate(p.birthDate) ? ageOn(p.birthDate, new Date(startYear, 0, 1)) : p.age;
}
