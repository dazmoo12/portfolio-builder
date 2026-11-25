import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildHouseholdView } from './charts/household';
import { buildViewModel } from './charts/model';
import { catalog } from './catalog';
import { applyAssumptions } from './catalog/assumptions';
import { hasHouseholdData } from './engine/household';
import { project, validateWeights } from './engine/projection';
import type { Lang } from './engine/types';
import { Report } from './export/Report';
import { exportPptx, pptxFileName } from './export/pptx';
import type { ClientDoc } from './documents/readers';
import { download, writeFile, type ClientFolder } from './folder/clientFolder';
import { languages, makeFormat, makeT } from './i18n';
import { migrateState, newClientState, useAppState, type AppState } from './state';
import { builtInThemes, loadCustomThemes, saveCustomThemes, type Theme } from './templates/themes';
import { AdvisorSection } from './ui/AdvisorSection';
import { ClientsSection } from './ui/ClientsSection';
import { DesignSection } from './ui/DesignSection';
import { DocumentsView } from './ui/DocumentsView';
import { JourneySection } from './ui/JourneySection';
import { OutputSection } from './ui/OutputSection';
import { FolderSection } from './ui/FolderSection';
import { HouseholdSection } from './ui/HouseholdSection';
import { Preview } from './ui/Preview';
import { AssumptionsSection, CostsSection } from './ui/AssumptionsSection';
import { AmountsSection, ClientSection, PositionsSection, PresetSection, Section } from './ui/Settings';

/** Pages of the phone layout; on larger screens everything is shown side by side. */
const M_PAGES = ['client', 'household', 'portfolio', 'preview', 'settings', 'export'] as const;
type MPage = (typeof M_PAGES)[number];
const M_PAGE_LABEL = {
  client: 'mPageClient',
  household: 'mPageHousehold',
  portfolio: 'mPagePortfolio',
  preview: 'mPagePreview',
  settings: 'mPageSettings',
  export: 'mPageExport',
} as const;

export default function App() {
  const { state, setState, update, updateInput } = useAppState();
  const [customThemes, setCustomThemes] = useState<Theme[]>(loadCustomThemes);
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<ClientFolder | null>(null);
  const [docs, setDocs] = useState<ClientDoc[]>([]);
  const [stageTab, setStageTab] = useState<'preview' | 'documents'>('preview');
  const loadInput = useRef<HTMLInputElement>(null);
  const [mPage, setMPage] = useState<MPage>('client');
  const pageIdx = M_PAGES.indexOf(mPage);
  const goPage = (p: MPage) => {
    setMPage(p);
    window.scrollTo(0, 0);
  };

  const themes = [...builtInThemes, ...customThemes];
  const theme = themes.find((th) => th.id === state.themeId) ?? builtInThemes[0];
  const t = makeT(state.uiLang);
  const fmt = makeFormat(state.uiLang);

  // the catalogue with the team's return and cost values
  const products = useMemo(() => applyAssumptions(catalog, state.assumptions), [state.assumptions]);
  const projection = useMemo(
    () => project({ ...state.input, depotFee: state.assumptions.depotFee }, products),
    [state.input, products, state.assumptions.depotFee],
  );
  const vm = useMemo(
    () => buildViewModel(state.input, projection, theme, state.reportLang, state.yearIndex, state.real, state.output),
    [state.input, projection, theme, state.reportLang, state.yearIndex, state.real, state.output],
  );
  const household = useMemo(
    () => (state.includeHousehold && hasHouseholdData(state.household) ? buildHouseholdView(state, vm) : undefined),
    [state, vm],
  );
  const check = useMemo(() => validateWeights(state.input, products), [state.input, products]);
  const warnings = useMemo(
    () => (household && household.summary.reserve < 0 ? [...check.warnings, { key: 'overBudget' as const }] : check.warnings),
    [check, household],
  );
  const onYear = useCallback((yearIndex: number) => update({ yearIndex }), [update]);
  const togglePosition = (uid: string) =>
    setState((s) => {
      const { hidden } = s.output;
      return { ...s, output: { ...s.output, hidden: hidden.includes(uid) ? hidden.filter((x) => x !== uid) : [...hidden, uid] } };
    });
  // the current client is already saved (see useAppState); leave its folder and documents behind
  const switchClient = (next: AppState) => {
    setFolder(null);
    setDocs([]);
    setStageTab('preview');
    setMPage('client');
    setState(next);
  };
  const fileSafeName = vm.clientName.replace(/[^\p{L}\p{N}-]+/gu, '_');

  const saveTheme = (th: Theme) => {
    const next = [...customThemes.filter((x) => x.id !== th.id), th];
    setCustomThemes(next);
    saveCustomThemes(next);
    update({ themeId: th.id });
  };
  const deleteTheme = (id: string) => {
    const next = customThemes.filter((x) => x.id !== id);
    setCustomThemes(next);
    saveCustomThemes(next);
    update({ themeId: builtInThemes[0].id });
  };

  // PDF: render the print layout, then open the browser print dialog ("Save as PDF")
  useEffect(() => {
    if (!printing) return;
    const prevTitle = document.title;
    document.title = `Portfolio_${fileSafeName}_${state.reportLang.toUpperCase()}`;
    const done = () => {
      document.title = prevTitle;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 600);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePortfolio = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `Portfolio_${fileSafeName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const props = { state, t, fmt, theme, update, updateInput };

  // ?report shows the PDF layout on screen (for checking templates without printing)
  if (new URLSearchParams(window.location.search).has('report')) {
    return (
      <div className="print-root screen">
        <Report vm={vm} advisor={state.advisor} household={household} />
      </div>
    );
  }

  return (
    <>
      <div className="app" data-mpage={mPage}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" />
            {t('appTitle')}
          </div>
          <button
            className="btn topbar-btn"
            onClick={() => {
              const c = state.input.client;
              const unsavedWork = c.birthDate || c.children.length || c.adults.length || state.household.income.length || state.household.expenses.length;
              if (!c.name.trim() && unsavedWork && !window.confirm(t('confirmNewUnnamed'))) return;
              switchClient(newClientState(state));
            }}
          >
            {t('newClient')}
          </button>
          <label className="lang">
            <span>{t('uiLanguage')}</span>
            <select
              value={state.uiLang}
              // switches the document too; the export section can still set a different document language
              onChange={(e) => update({ uiLang: e.target.value as Lang, reportLang: e.target.value as Lang })}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {/* phones: the inputs and the result as pages to go through (hidden on larger screens) */}
        <nav className="m-nav" aria-label={t('appTitle')}>
          {M_PAGES.map((p, i) => (
            <button key={p} className={mPage === p ? 'on' : ''} aria-current={mPage === p ? 'page' : undefined} onClick={() => goPage(p)}>
              {i + 1}. {t(M_PAGE_LABEL[p])}
            </button>
          ))}
        </nav>

        <aside className="sidebar">
          <div className="m-group" data-page="client">
          <FolderSection
            t={t}
            state={state}
            folder={folder}
            setFolder={setFolder}
            setState={setState}
            docs={docs}
            setDocs={setDocs}
            onShowDocs={() => {
              setStageTab('documents');
              setMPage('preview');
            }}
          />
          <ClientsSection t={t} fmt={fmt} state={state} onOpen={switchClient} />
          <ClientSection {...props} />
          <AdvisorSection t={t} advisor={state.advisor} onChange={(advisor) => update({ advisor })} />
          </div>
          <div className="m-group" data-page="household">
          <HouseholdSection state={state} t={t} fmt={fmt} update={update} />
          </div>
          <div className="m-group" data-page="portfolio">
          <AmountsSection {...props} />
          <PresetSection {...props} />
          <PositionsSection {...props} />
          </div>
          <div className="m-group" data-page="settings">
          <AssumptionsSection {...props} products={products} />
          <CostsSection {...props} products={products} />
          <OutputSection t={t} output={state.output} onChange={(output) => update({ output })} />
          <JourneySection
            t={t}
            journey={state.output.journey}
            avds={vm.allPositions.filter((p) => p.kind === 'avd')}
            onChange={(journey) => update({ output: { ...state.output, journey } })}
          />
          <DesignSection t={t} theme={theme} themes={themes} onSelect={(id) => update({ themeId: id })} onSave={saveTheme} onDelete={deleteTheme} />
          </div>
          <div className="m-group" data-page="export">
          <Section title={t('secExport')}>
            <label className="field">
              <span>{t('reportLanguage')}</span>
              <select value={state.reportLang} onChange={(e) => update({ reportLang: e.target.value as Lang })}>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            {folder && <p className="hint">{t('exportsToFolder')}</p>}
            <div className="upload-row">
              <button className="btn primary" disabled={printing} onClick={() => setPrinting(true)}>
                {t('exportPdf')}
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const blob = await exportPptx(vm, state.advisor, household);
                    // with an open client folder the deck lands right next to the client's documents
                    if (folder) await writeFile(folder, pptxFileName(vm), blob);
                    else download(pptxFileName(vm), blob);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('exportPptx')}
              </button>
            </div>
            <div className="upload-row">
              <button className="btn ghost" onClick={savePortfolio}>
                {t('savePortfolio')}
              </button>
              <button className="btn ghost" onClick={() => loadInput.current?.click()}>
                {t('loadPortfolio')}
              </button>
              <input
                ref={loadInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const s = migrateState(JSON.parse(await f.text()));
                    if (s) setState(s);
                  } catch {
                    /* invalid file – ignore */
                  }
                }}
              />
            </div>
          </Section>
          </div>
        </aside>

        <main className="stage">
          <div className="stage-tabs" role="tablist">
            <button role="tab" aria-selected={stageTab === 'preview'} className={stageTab === 'preview' ? 'on' : ''} onClick={() => setStageTab('preview')}>
              {t('appTitle')}
            </button>
            <button role="tab" aria-selected={stageTab === 'documents'} className={stageTab === 'documents' ? 'on' : ''} onClick={() => setStageTab('documents')}>
              {t('secDocuments')} {docs.length > 0 && <span className="badge">{docs.length}</span>}
            </button>
          </div>
          {stageTab === 'preview' ? (
            <Preview vm={vm} ui={t} uiLang={state.uiLang} warnings={warnings} household={household} onYear={onYear} onTogglePosition={togglePosition} />
          ) : (
            <DocumentsView t={t} fmt={fmt} docs={docs} state={state} setState={setState} />
          )}
        </main>

        <div className="m-pager">
          <button className="btn" disabled={pageIdx === 0} onClick={() => goPage(M_PAGES[pageIdx - 1])}>
            ← {t('mBack')}
          </button>
          <span>
            {pageIdx + 1} / {M_PAGES.length} · {t(M_PAGE_LABEL[mPage])}
          </span>
          <button className="btn primary" disabled={pageIdx === M_PAGES.length - 1} onClick={() => goPage(M_PAGES[pageIdx + 1])}>
            {t('mNext')} →
          </button>
        </div>
      </div>

      {printing && (
        <div className="print-root">
          <Report vm={vm} advisor={state.advisor} household={household} />
        </div>
      )}
    </>
  );
}
