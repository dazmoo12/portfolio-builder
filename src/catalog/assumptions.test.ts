import { describe, expect, it } from 'vitest';
import { applyAssumptions, assumptionsFile, defaultAssumptions, readAssumptionsFile, resetProduct, setOverride } from './assumptions';
import { catalog } from './index';

describe('editable assumptions and costs', () => {
  it('uses the agreed standard costs', () => {
    expect(catalog['rp-balance'].entryFee).toBe(0.04);
    expect(catalog['fund-dws-vbi'].entryFee).toBe(0.04);
    expect(catalog.avd.entryFee).toBe(0.01);
    expect([catalog['metal-gold'].entryFee, catalog['metal-gold'].exitFee, catalog['metal-gold'].annualFee]).toEqual([0.08, 0.007, 0.01]);
    expect([catalog['metal-silver'].entryFee, catalog['metal-silver'].exitFee, catalog['metal-silver'].annualFee]).toEqual([0.106, 0, 0.0131]);
    expect(defaultAssumptions().depotFee).toBe(36);
  });

  it('applies changed values and keeps the rest', () => {
    let a = setOverride(defaultAssumptions(), 'rp-balance', { scenario: 'neutral', value: 0.06 });
    a = setOverride(a, 'rp-balance', { cost: 'entryFee', value: 0.03 });
    const p = applyAssumptions(catalog, a)['rp-balance'];
    expect(p.returns).toEqual({ ...catalog['rp-balance'].returns, neutral: 0.06 });
    expect(p.entryFee).toBe(0.03);
  });

  it('drops an override that equals the standard again', () => {
    const changed = setOverride(defaultAssumptions(), 'avd', { cost: 'entryFee', value: 0.02 });
    expect(setOverride(changed, 'avd', { cost: 'entryFee', value: 0.01 }).products).toEqual({});
    expect(resetProduct(changed, 'avd', 'costs').products).toEqual({});
  });

  it('round-trips through a file and ignores unknown products', () => {
    const a = { ...setOverride(defaultAssumptions(), 'metal-gold', { cost: 'annualFee', value: 0.009 }), depotFee: 40 };
    expect(readAssumptionsFile(JSON.parse(assumptionsFile(a)))).toEqual(a);
    const foreign = { type: 'portfolio-builder-assumptions', assumptions: { products: { unknown: { entryFee: 0.1 } }, depotFee: 36 } };
    expect(readAssumptionsFile(foreign)?.products).toEqual({});
    expect(readAssumptionsFile({ type: 'other' })).toBeNull();
  });
});
