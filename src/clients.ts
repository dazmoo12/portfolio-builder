// Saved clients in this browser: every client with content is kept here automatically, so
// switching clients or starting a new one never loses work. Files and client folders remain
// the way to share a client or move it to another device.

export interface SavedClient<S> {
  id: string;
  name: string;
  /** Last real change (ISO). Opening or re-saving an unchanged client does not move it. */
  savedAt: string;
  /** Fingerprint of the content, to tell real changes from re-saves. */
  key: string;
  state: S;
}

export const CLIENTS_KEY = 'portfolio-builder.clients.v1';

function readAll<S>(): Record<string, SavedClient<S>> {
  try {
    return JSON.parse(localStorage.getItem(CLIENTS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function writeAll<S>(all: Record<string, SavedClient<S>>) {
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable */
  }
}

export const newClientId = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Newest change first. */
export function listClients<S>(): SavedClient<S>[] {
  return Object.values(readAll<S>()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getClient<S>(id: string): SavedClient<S> | undefined {
  return readAll<S>()[id];
}

/**
 * Stores the client if its content changed. `key` identifies the content (without view
 * settings such as the time slider). Returns the entry as stored.
 */
export function saveClient<S>(id: string, name: string, key: string, state: S, now = new Date().toISOString()): SavedClient<S> {
  const all = readAll<S>();
  const prev = all[id];
  if (prev && prev.key === key && prev.name === name.trim()) {
    // same content: keep the time of the last real change, but store view settings
    all[id] = { ...prev, state };
  } else {
    all[id] = { id, name: name.trim(), savedAt: now, key, state };
  }
  writeAll(all);
  return all[id];
}

export function deleteClient(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

/** Id of a saved client with this name, for portfolios saved before clients had ids. */
export function clientIdByName(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  return n ? listClients().find((c) => c.name.toLowerCase() === n)?.id : undefined;
}
