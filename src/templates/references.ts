// Turning uploaded references into a template:
//  - logo image  → dominant colours via simple colour quantisation
//  - .pptx/.potx → theme colours and fonts from ppt/theme/theme1.xml

import JSZip from 'jszip';
import { builtInThemes, luminance, rgbToHex, hexToRgb, type Theme } from './themes';

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function saturation(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Extracts up to `n` dominant, non-white/non-black colours from an image. */
export async function extractPalette(dataUrl: string, n = 4): Promise<string[]> {
  const img = await loadImage(dataUrl);
  const size = 96;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // bucket colours into a 4-bit-per-channel histogram
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 235 || max < 20) continue; // skip white background / pure black
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    e.r += r;
    e.g += g;
    e.b += b;
    e.count++;
    buckets.set(key, e);
  }
  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((e) => rgbToHex(e.r / e.count, e.g / e.count, e.b / e.count));

  // keep visually distinct colours
  const picked: string[] = [];
  const dist = (a: string, b: string) => {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  };
  for (const c of sorted) {
    if (picked.every((p) => dist(p, c) > 60)) picked.push(c);
    if (picked.length >= n) break;
  }
  return picked;
}

/** Builds a theme from logo colours: darkest → primary, most saturated other → accent. */
export function themeFromPalette(palette: string[], logo: string, base: Theme = builtInThemes[0]): Theme {
  const byDark = [...palette].sort((a, b) => luminance(a) - luminance(b));
  const primary = byDark[0] && luminance(byDark[0]) < 0.2 ? byDark[0] : base.colors.primary;
  const rest = palette.filter((c) => c !== primary).sort((a, b) => saturation(b) - saturation(a));
  return {
    ...base,
    id: `custom-${Date.now()}`,
    name: 'Logo',
    builtIn: false,
    logo,
    colors: {
      ...base.colors,
      primary,
      text: primary,
      accent: rest[0] ?? base.colors.accent,
      accent2: rest[1] ?? base.colors.accent2,
    },
  };
}

/** Reads colour scheme, fonts and (if present) the logo of the slide master. */
export async function themeFromPptx(data: ArrayBuffer | Uint8Array, fileName: string, base: Theme = builtInThemes[0]): Promise<Theme> {
  const zip = await JSZip.loadAsync(data);
  const themePath = Object.keys(zip.files).find((p) => /^ppt\/theme\/theme\d+\.xml$/.test(p));
  if (!themePath) throw new Error('No theme found in file');
  const xml = new DOMParser().parseFromString(await zip.file(themePath)!.async('string'), 'application/xml');
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

  const color = (name: string): string | undefined => {
    const el = xml.getElementsByTagNameNS(A, name)[0];
    if (!el) return undefined;
    const srgb = el.getElementsByTagNameNS(A, 'srgbClr')[0]?.getAttribute('val');
    const sys = el.getElementsByTagNameNS(A, 'sysClr')[0]?.getAttribute('lastClr');
    const v = srgb ?? sys;
    return v ? `#${v.toUpperCase()}` : undefined;
  };
  const font = (group: 'majorFont' | 'minorFont') =>
    xml.getElementsByTagNameNS(A, group)[0]?.getElementsByTagNameNS(A, 'latin')[0]?.getAttribute('typeface') ?? undefined;

  const dk1 = color('dk1');
  const dk2 = color('dk2');
  const accents = [1, 2, 3, 4, 5, 6].map((i) => color(`accent${i}`)).filter(Boolean) as string[];
  const candidates = [dk2, ...accents].filter(Boolean) as string[];

  // primary: darkest corporate colour (dk2/accents) if it is dark enough, otherwise dk1
  const darkest = [...candidates].sort((a, b) => luminance(a) - luminance(b))[0];
  const primary = darkest && luminance(darkest) < 0.2 ? darkest : dk1 ?? base.colors.primary;
  // accent: most saturated mid-tone; accent2: lightest corporate colour
  const mid = candidates.filter((x) => x !== primary && luminance(x) > 0.1 && luminance(x) < 0.6);
  const accent = [...mid].sort((a, b) => saturation(b) - saturation(a))[0] ?? base.colors.accent;
  const accent2 = [...candidates].filter((x) => x !== accent).sort((a, b) => luminance(b) - luminance(a))[0] ?? base.colors.accent2;
  // chart series: corporate colours that are neither too dark nor too light, padded with validated defaults
  const seriesCandidates = candidates.filter((x) => luminance(x) > 0.06 && luminance(x) < 0.45);
  const series = [...new Set([...seriesCandidates, ...base.colors.series])].slice(0, 6);

  // logo: the largest bitmap referenced by the slide master (small icons and full-page photos are skipped)
  let logo: string | undefined;
  const relsPath = Object.keys(zip.files).find((p) => /^ppt\/slideMasters\/_rels\/slideMaster1\.xml\.rels$/.test(p));
  if (relsPath) {
    const rels = await zip.file(relsPath)!.async('string');
    const targets = [...rels.matchAll(/Target="\.\.\/media\/([^"]+\.(?:png|jpe?g))"/gi)].map((m) => `ppt/media/${m[1]}`);
    const sized = await Promise.all(
      targets.filter((p) => zip.file(p)).map(async (p) => ({ p, size: (await zip.file(p)!.async('uint8array')).length })),
    );
    const pick = sized.filter((x) => x.size > 2_000 && x.size < 400_000).sort((a, b) => b.size - a.size)[0];
    if (pick) {
      const ext = pick.p.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg');
      logo = `data:image/${ext};base64,${await zip.file(pick.p)!.async('base64')}`;
    }
  }

  return {
    ...base,
    id: `custom-${Date.now()}`,
    name: fileName.replace(/\.(pptx|potx)$/i, ''),
    builtIn: false,
    logo,
    colors: {
      ...base.colors,
      primary,
      text: primary,
      accent,
      accent2,
      series,
    },
    fonts: {
      heading: font('majorFont') ?? base.fonts.heading,
      body: font('minorFont') ?? base.fonts.body,
    },
  };
}
