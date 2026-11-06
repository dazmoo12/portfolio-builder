import { describe, expect, it } from 'vitest';
import { defaultState, migrateState } from './state';

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
        client: { name: client.name, age: 32, childrenBirthYears: [2021], partner: { name: 'Max', age: 40 } },
        positions: [{ uid: 'a', productId: 'avd', monthlyWeight: 0.5, oneOffWeight: 0, owner: 'partner' }],
      },
    };
  };

  it('keeps partner, children and the common start and duration', () => {
    const { input } = migrateState(old())!;
    expect(input.client.adults).toEqual([{ id: 'partner', name: 'Max', age: 40 }]);
    expect(input.client.children.map((c) => c.birthYear)).toEqual([2021]);
    expect(input.positions[0]).toMatchObject({ owner: 'partner', start: '2028-01', years: 20 });
    expect([input.startYear, input.horizonYears]).toEqual([2028, 20]);
  });

  it('leaves current portfolios unchanged', () => {
    const s = defaultState();
    expect(migrateState(JSON.parse(JSON.stringify(s)))!.input).toEqual(s.input);
  });
});
