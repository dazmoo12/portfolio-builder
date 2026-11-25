// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deleteClient, getClient, listClients, saveClient } from './clients';
import { contentKey, defaultState, keepClient, migrateState, newClientState, newerCopy, storeClient } from './state';

describe('saved portfolios from older versions', () => {
  const old = () => {
    const s = defaultState();
    const { client } = s.input;
    return {
      ...s,
      input: {
        ...s.input,
        startYear: 2028,
        horizonYears: 20,
        client: { name: client.name, age: 32, childrenBirthYears: [2021], partner: { name: 'Max', age: 40 }, childBonusOwner: 'partner' },
        positions: [{ uid: 'a', productId: 'avd', monthlyWeight: 0.5, oneOffWeight: 0, owner: 'partner' }],
      },
    };
  };

  it('keeps partner, children and the common start and duration', () => {
    const { input } = migrateState(old())!;
    expect(input.client.adults).toEqual([{ id: 'partner', name: 'Max', age: 40 }]);
    expect(input.client.children.map((c) => [c.birthYear, c.bonusOwner])).toEqual([[2021, 'partner']]);
    expect(input.positions[0]).toMatchObject({ owner: 'partner', start: '2028-01', years: 20 });
    expect([input.startYear, input.horizonYears]).toEqual([2028, 20]);
  });

  it('leaves current portfolios unchanged', () => {
    const s = defaultState();
    expect(migrateState(JSON.parse(JSON.stringify(s)))!.input).toEqual(s.input);
  });
});

describe('saved clients', () => {
  const named = (name: string) => {
    const d = defaultState();
    return { ...d, input: { ...d.input, client: { ...d.input.client, name } } };
  };

  it('keeps the previous client when a new one starts', () => {
    localStorage.clear();
    const a = named('Kunde A');
    storeClient(a);
    const b = newClientState(a);
    expect(b.clientId).not.toBe(a.clientId);
    expect(keepClient(b)).toBe(false); // nothing entered yet
    expect(storeClient(b)).toBeUndefined();
    expect(listClients().map((c) => c.name)).toEqual(['Kunde A']);
    deleteClient(a.clientId);
    expect(listClients()).toEqual([]);
  });

  it('keeps a client without a name once something is entered', () => {
    localStorage.clear();
    const b = { ...newClientState(defaultState()), pristine: false };
    expect(storeClient(b)).toBeDefined();
    expect(listClients()).toHaveLength(1);
  });

  it('moves the time of the last change only when the content changes', () => {
    localStorage.clear();
    const a = named('Kunde A');
    saveClient(a.clientId, 'Kunde A', contentKey(a), a, '2026-01-01T10:00:00Z');
    saveClient(a.clientId, 'Kunde A', contentKey({ ...a, yearIndex: 3 }), { ...a, yearIndex: 3 }, '2026-01-02T10:00:00Z');
    expect(getClient(a.clientId)!.savedAt).toBe('2026-01-01T10:00:00Z');
    const changed = { ...a, input: { ...a.input, totalMonthly: 500 } };
    saveClient(a.clientId, 'Kunde A', contentKey(changed), changed, '2026-01-03T10:00:00Z');
    expect(getClient(a.clientId)!.savedAt).toBe('2026-01-03T10:00:00Z');
  });

  it('gives old files without an id the id of the saved client with the same name', () => {
    localStorage.clear();
    const a = defaultState();
    saveClient('k-old', a.input.client.name, contentKey(a), a);
    const { clientId, ...noId } = a;
    expect(migrateState(noId)!.clientId).toBe('k-old');
    void clientId;
  });
});

describe('portfolio file against the browser copy', () => {
  const base = () => {
    localStorage.clear();
    const d = defaultState();
    const browser = { ...d, input: { ...d.input, totalMonthly: 500 } };
    saveClient(d.clientId, d.input.client.name, contentKey(browser), browser, '2026-11-20T10:00:00Z');
    return d;
  };

  it('keeps the newer browser copy over an older file', () => {
    const file = { ...base(), updatedAt: '2026-11-19T10:00:00Z' };
    const c = newerCopy(file);
    expect(c.pick).toBe('browser');
    expect(c.browser!.input.totalMonthly).toBe(500);
  });

  it('uses a newer file', () => {
    expect(newerCopy({ ...base(), updatedAt: '2026-11-21T10:00:00Z' }).pick).toBe('file');
  });

  it('asks for files without a time that differ from the browser copy', () => {
    expect(newerCopy(base()).pick).toBe('ask');
  });

  it('uses the file when both are the same or the browser does not know the client', () => {
    localStorage.clear();
    expect(newerCopy(defaultState()).pick).toBe('file');
  });
});
