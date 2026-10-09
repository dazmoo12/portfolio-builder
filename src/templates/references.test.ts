// @vitest-environment jsdom
// jsdom provides DOMParser, which the theme reader needs
import { describe, expect, it } from 'vitest';
import PptxGenJS from 'pptxgenjs';
import { themeFromPptx } from './references';

describe('themeFromPptx', () => {
  it('reads fonts and colours from a PowerPoint file', async () => {
    const pptx = new PptxGenJS();
    pptx.theme = { headFontFace: 'Corporate Head', bodyFontFace: 'Corporate Body' };
    pptx.addSlide().addText('x', { x: 1, y: 1, w: 1, h: 1 });
    const data = (await pptx.write({ outputType: 'uint8array' })) as Uint8Array;
    const theme = await themeFromPptx(data, 'Brand.potx');
    expect(theme.name).toBe('Brand');
    expect(theme.fonts).toEqual({ heading: 'Corporate Head', body: 'Corporate Body' });
    expect(theme.colors.primary).toMatch(/^#[0-9A-F]{6}$/);
    expect(theme.colors.series).toHaveLength(6);
  });
});
