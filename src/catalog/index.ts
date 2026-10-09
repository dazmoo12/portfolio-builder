import productsJson from './products.json';
import presetsJson from './presets.json';
import type { Localized, Position, Product } from '../engine/types';
import type { Catalog } from '../engine/projection';

export const products = productsJson.products as Product[];
export const catalog: Catalog = Object.fromEntries(products.map((p) => [p.id, p]));

export interface Preset {
  id: string;
  name: Localized;
  positions: { productId: string; monthly: number; oneOff: number }[];
}
export const presets = presetsJson.presets as Preset[];

let uidCounter = 0;
export const newUid = () => `p${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export function presetPositions(preset: Preset): Position[] {
  return preset.positions.map((p) => ({
    uid: newUid(),
    productId: p.productId,
    monthlyWeight: p.monthly,
    oneOffWeight: p.oneOff,
  }));
}
