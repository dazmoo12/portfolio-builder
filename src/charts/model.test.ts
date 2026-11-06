import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { project } from '../engine/projection';
import { defaultOutput, defaultState } from '../state';
import { builtInThemes } from '../templates/themes';
import { buildViewModel } from './model';

const s = defaultState();
const projection = project(s.input, catalog);
const vm = (hidden: string[]) => buildViewModel(s.input, projection, builtInThemes[0], 'de', 35, false, { ...defaultOutput(), hidden });

describe('product selection', () => {
  it('figures add up to the shown products only', () => {
    const all = vm([]);
    const [avd, depot, gold] = all.positions;
    const v = vm([avd.uid, gold.uid]);
    expect(v.kpi.value).toBeCloseTo(depot.value);
    expect(v.kpi.paidIn).toBeCloseTo(depot.paidIn);
    expect(v.kpi.subsidy).toBe(0);
    expect(v.kpi.gains).toBeCloseTo(depot.gains);
    expect(v.amounts.monthly).toBeCloseTo(depot.monthly);
    expect(v.hiddenNames).toEqual([avd.name, gold.name]);
    expect(v.allPositions).toHaveLength(3); // stay available to switch back on
    expect(v.development.totals.neutral.at(-1)).toBeCloseTo(depot.value);
  });

  it('shows everything by default', () => {
    const all = vm([]);
    expect(all.kpi.value).toBeCloseTo(all.positions.reduce((a, p) => a + p.value, 0));
    expect(all.hiddenNames).toEqual([]);
  });
});
