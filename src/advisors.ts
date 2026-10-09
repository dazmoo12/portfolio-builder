// Saved advisor contact details (per browser), so new clients start with the right contact block.

import type { Advisor } from './state';

export interface AdvisorProfile extends Advisor {
  id: string;
}

const KEY = 'portfolio-builder.advisors.v1';
const DEFAULT_KEY = 'portfolio-builder.defaultAdvisor.v1';

export function loadAdvisors(): AdvisorProfile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AdvisorProfile[];
  } catch {
    return [];
  }
}

export function saveAdvisors(list: AdvisorProfile[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function loadDefaultAdvisorId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_KEY);
  } catch {
    return null;
  }
}

export function saveDefaultAdvisorId(id: string | null) {
  try {
    if (id) localStorage.setItem(DEFAULT_KEY, id);
    else localStorage.removeItem(DEFAULT_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Contact details of the default profile, if one is set. */
export function defaultAdvisor(): Advisor | null {
  const id = loadDefaultAdvisorId();
  const p = loadAdvisors().find((a) => a.id === id);
  if (!p) return null;
  const { id: _id, ...advisor } = p;
  return advisor;
}

export const sameAdvisor = (a: Advisor, b: Advisor) =>
  a.name === b.name && a.office === b.office && a.phone === b.phone && a.email === b.email;
