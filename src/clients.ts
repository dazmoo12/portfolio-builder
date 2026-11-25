// Saved clients in this browser: every client with a name is kept here automatically, so
// "+ New client" never loses work. Files and client folders remain the way to share a client.

export interface SavedClient<S> {
  id: string;
  name: string;
  savedAt: string;
  state: S;
}

const KEY = 'portfolio-builder.clients.v1';

function readAll<S>(): Record<string, SavedClient<S>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function writeAll<S>(all: Record<string, SavedClient<S>>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable */
  }
}

export const newClientId = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Newest first. */
export function listClients<S>(): SavedClient<S>[] {
  return Object.values(readAll<S>()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Stores the client; clients without a name are not kept. Returns true if saved. */
export function saveClient<S>(id: string, name: string, state: S): boolean {
  if (!name.trim()) return false;
  const all = readAll<S>();
  all[id] = { id, name: name.trim(), savedAt: new Date().toISOString(), state };
  writeAll(all);
  return true;
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
