import type { CSSProperties } from 'react';
import { onColor, type Theme } from '../templates/themes';

/** Exposes a template as CSS custom properties for the preview and the print report. */
export function themeVars(theme: Theme): CSSProperties {
  const c = theme.colors;
  return {
    '--t-primary': c.primary,
    '--t-on-primary': onColor(c.primary),
    '--t-accent': c.accent,
    '--t-accent2': c.accent2,
    '--t-bg': c.background,
    '--t-surface': c.surface,
    '--t-text': c.text,
    '--t-muted': c.muted,
    '--t-font-heading': `"${theme.fonts.heading}", Georgia, serif`,
    '--t-font-body': `"${theme.fonts.body}", "Segoe UI", system-ui, sans-serif`,
  } as CSSProperties;
}
