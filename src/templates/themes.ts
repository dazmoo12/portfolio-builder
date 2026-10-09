// Output templates. A template = colours + fonts + optional logo. It drives the
// live preview, the PDF report and the PowerPoint export alike.

export interface Theme {
  id: string;
  name: string;
  builtIn?: boolean;
  colors: {
    /** Headlines, dark panels. */
    primary: string;
    /** Kicker lines, highlights. */
    accent: string;
    /** Positive numbers / subsidy highlight. */
    accent2: string;
    /** Page background. */
    background: string;
    /** Cards / boxes on the page. */
    surface: string;
    text: string;
    muted: string;
    /** Chart series in fixed order (validated for colour-vision deficiency). */
    series: string[];
  };
  fonts: { heading: string; body: string };
  /** Logo as data URL (PNG/JPEG/SVG). */
  logo?: string;
}

// Series palettes were checked with the dataviz palette validator (light mode):
// lightness band, chroma floor, CVD separation and normal-vision floor all pass.
const SERIES_CLASSIC = ['#2B5DA8', '#C49A1F', '#2E9A6A', '#8A55C0', '#C2553A', '#1F9FB5'];
const SERIES_GOLD = ['#B07F1A', '#2B5DA8', '#C2553A', '#2E9A6A', '#8A55C0', '#1F9FB5'];

export const builtInThemes: Theme[] = [
  {
    id: 'classic',
    name: 'Vermögensberatung Classic',
    builtIn: true,
    colors: {
      primary: '#1B2A41',
      accent: '#C9A227',
      accent2: '#8ED1A5',
      background: '#FFFFFF',
      surface: '#F1F4F8',
      text: '#1B2A41',
      muted: '#6B7686',
      series: SERIES_CLASSIC,
    },
    fonts: { heading: 'Georgia', body: 'Segoe UI' },
  },
  {
    id: 'noir',
    name: 'Edelmetall Noir',
    builtIn: true,
    colors: {
      primary: '#211D19',
      accent: '#A8823A',
      accent2: '#E3D3B0',
      background: '#F9F7F2',
      surface: '#EFEAE0',
      text: '#211D19',
      muted: '#7A7064',
      series: SERIES_GOLD,
    },
    fonts: { heading: 'Palatino Linotype', body: 'Segoe UI' },
  },
  {
    id: 'fresh',
    name: 'Clean Blue',
    builtIn: true,
    colors: {
      primary: '#0F4C81',
      accent: '#1F9FB5',
      accent2: '#9ED8C3',
      background: '#FFFFFF',
      surface: '#EEF5FA',
      text: '#14273A',
      muted: '#5F7183',
      series: SERIES_CLASSIC,
    },
    fonts: { heading: 'Segoe UI Semibold', body: 'Segoe UI' },
  },
];

const STORAGE_KEY = 'portfolio-builder.templates.v1';

export function loadCustomThemes(): Theme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Theme[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: Theme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch {
    /* storage unavailable or full (large logo) – templates stay in memory */
  }
}

export function isTheme(x: unknown): x is Theme {
  const t = x as Theme;
  return !!t && typeof t.name === 'string' && !!t.colors?.primary && Array.isArray(t.colors?.series) && !!t.fonts;
}

/** Hex helpers */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Readable text colour on a given background. */
export function onColor(bg: string): string {
  return luminance(bg) > 0.4 ? '#1B2A41' : '#FFFFFF';
}
