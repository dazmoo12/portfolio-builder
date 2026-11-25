// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deleteClient, listClients, saveClient } from './clients';
import { defaultState, migrateState, newClientState } from './state';

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
  it('keeps the previous client when a new one starts', () => {
    localStorage.clear();
    const a = { ...defaultState(), input: { ...defaultState().input, client: { ...defaultState().input.client, name: 'Kunde A' } } };
    saveClient(a.clientId, a.input.client.name, a);
    const b = newClientState(a);
    expect(b.clientId).not.toBe(a.clientId);
    expect(saveClient(b.clientId, b.input.client.name, b)).toBe(false); // no name yet: not kept
    expect(listClients().map((c) => c.name)).toEqual(['Kunde A']);
    deleteClient(a.clientId);
    expect(listClients()).toEqual([]);
  });

  it('gives old files without an id the id of the saved client with the same name', () => {
    localStorage.clear();
    const a = defaultState();
    saveClient('k-old', a.input.client.name, a);
    const { clientId, ...noId } = a;
    expect(migrateState(noId)!.clientId).toBe('k-old');
    void clientId;
  });
});
