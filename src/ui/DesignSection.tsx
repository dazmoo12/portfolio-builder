import { useRef, useState } from 'react';
import type { T } from '../i18n';
import { extractPalette, readAsDataUrl, themeFromPalette, themeFromPptx } from '../templates/references';
import { isTheme, type Theme } from '../templates/themes';
import { Section } from './Settings';

interface Props {
  t: T;
  theme: Theme;
  themes: Theme[];
  onSelect: (id: string) => void;
  /** Adds or replaces a custom template and selects it. */
  onSave: (theme: Theme) => void;
  onDelete: (id: string) => void;
}

function download(name: string, content: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DesignSection({ t, theme, themes, onSelect, onSave, onDelete }: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const pptxInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // edits on a built-in template create a custom copy, built-ins stay untouched
  const edit = (patch: Partial<Theme>) => {
    const base = theme.builtIn ? { ...theme, id: `custom-${Date.now()}`, name: `${theme.name} (${t('customTemplate')})`, builtIn: false } : theme;
    onSave({ ...base, ...patch });
  };
  const setColor = (k: keyof Theme['colors'], v: string) => edit({ colors: { ...theme.colors, [k]: v } });

  return (
    <Section title={t('secDesign')} defaultOpen={false}>
      <div className="template-gallery">
        {themes.map((th) => (
          <button key={th.id} className={`tpl ${th.id === theme.id ? 'on' : ''}`} onClick={() => onSelect(th.id)} title={th.name}>
            <span className="tpl-swatch">
              <i style={{ background: th.colors.primary }} />
              <i style={{ background: th.colors.accent }} />
              <i style={{ background: th.colors.accent2 }} />
              <i style={{ background: th.colors.background, border: '1px solid #ddd' }} />
            </span>
            <span className="tpl-name">{th.name}</span>
          </button>
        ))}
      </div>

      <div className="upload-row">
        <button className="btn" disabled={busy} onClick={() => logoInput.current?.click()}>
          {t('uploadLogo')}
        </button>
        <button className="btn" disabled={busy} onClick={() => pptxInput.current?.click()}>
          {t('uploadPptx')}
        </button>
      </div>
      <input
        ref={logoInput}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f)
            run(async () => {
              const url = await readAsDataUrl(f);
              const palette = await extractPalette(url);
              onSave({ ...themeFromPalette(palette, url, theme), name: f.name.replace(/\.\w+$/, '') });
            });
        }}
      />
      <input
        ref={pptxInput}
        type="file"
        accept=".pptx,.potx"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) run(async () => onSave(await themeFromPptx(await f.arrayBuffer(), f.name, theme)));
        }}
      />
      {error && <div className="warnings">⚠ {error}</div>}

      <div className="field">
        <span>{t('templateName')}</span>
        <input value={theme.name} disabled={theme.builtIn} onChange={(e) => edit({ name: e.target.value })} />
      </div>
      <div className="colors">
        {(
          [
            ['primary', 'colorPrimary'],
            ['accent', 'colorAccent'],
            ['accent2', 'colorAccent2'],
            ['background', 'colorBackground'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="color">
            <input type="color" value={theme.colors[k]} onChange={(e) => setColor(k, e.target.value.toUpperCase())} />
            <span>{t(label)}</span>
          </label>
        ))}
      </div>
      <div className="row2">
        <label className="field">
          <span>{t('fontHeading')}</span>
          <input value={theme.fonts.heading} onChange={(e) => edit({ fonts: { ...theme.fonts, heading: e.target.value } })} />
        </label>
        <label className="field">
          <span>{t('fontBody')}</span>
          <input value={theme.fonts.body} onChange={(e) => edit({ fonts: { ...theme.fonts, body: e.target.value } })} />
        </label>
      </div>

      <div className="upload-row">
        {theme.logo && (
          <button className="btn ghost" onClick={() => edit({ logo: undefined })}>
            {t('removeLogo')}
          </button>
        )}
        <button
          className="btn ghost"
          onClick={() => download(`${theme.name.replace(/[^\w-]+/g, '_')}.template.json`, JSON.stringify(theme, null, 2), 'application/json')}
        >
          {t('exportTemplate')}
        </button>
        <button className="btn ghost" onClick={() => jsonInput.current?.click()}>
          {t('importTemplate')}
        </button>
        {!theme.builtIn && (
          <button className="btn ghost danger" onClick={() => onDelete(theme.id)}>
            {t('deleteTemplate')}
          </button>
        )}
      </div>
      <input
        ref={jsonInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f)
            run(async () => {
              const parsed = JSON.parse(await f.text());
              if (!isTheme(parsed)) throw new Error('Invalid template file');
              onSave({ ...parsed, id: `custom-${Date.now()}`, builtIn: false });
            });
        }}
      />
    </Section>
  );
}
