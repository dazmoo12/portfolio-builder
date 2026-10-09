import { useEffect, useState } from 'react';
import { applyCandidate } from '../documents/apply';
import { findCandidates, type Candidate } from '../documents/extract';
import { ocr, pdfToCanvases, readDoc, type ClientDoc, type DocContent, type DocKind } from '../documents/readers';
import type { Format, T, TKey } from '../i18n';
import type { AppState } from '../state';

interface Props {
  t: T;
  fmt: Format;
  docs: ClientDoc[];
  state: AppState;
  setState: (s: AppState) => void;
}

const ICON: Record<DocKind, string> = {
  image: '🖼', pdf: '📕', word: '📘', excel: '📗', powerpoint: '📙', text: '📄', json: '🧾', other: '📎',
};

type Loaded = { content?: DocContent; error?: string; candidates: Candidate[] };

function sizeLabel(n: number) {
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

export function DocumentsView({ t, fmt, docs, state, setState }: Props) {
  const [selected, setSelected] = useState<string | null>(docs[0]?.id ?? null);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [busy, setBusy] = useState('');
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(0);

  const doc = docs.find((d) => d.id === selected) ?? null;
  const cur = doc ? loaded[doc.id] : undefined;

  useEffect(() => {
    if (!doc || loaded[doc.id]) return;
    let cancelled = false;
    setBusy(t('docReading'));
    setSheet(0);
    readDoc(doc)
      .then((content) => !cancelled && setLoaded((l) => ({ ...l, [doc.id]: { content, candidates: findCandidates(content, doc.path) } })))
      .catch((e) => !cancelled && setLoaded((l) => ({ ...l, [doc.id]: { error: String(e?.message ?? e), candidates: [] } })))
      .finally(() => !cancelled && setBusy(''));
    return () => {
      cancelled = true;
    };
  }, [doc, loaded, t]);

  const runOcr = async () => {
    if (!doc || !cur?.content) return;
    try {
      setBusy(t('docOcrRunning', { progress: '' }));
      const file = await doc.getFile();
      const sources = doc.kind === 'pdf' ? await pdfToCanvases(file) : [file];
      const text = await ocr(sources, (p) => setBusy(t('docOcrRunning', { progress: `${Math.round(p * 100)} %` })));
      const content = { ...cur.content, text: [cur.content.text, text].filter(Boolean).join('\n\n'), scanned: false };
      setLoaded((l) => ({ ...l, [doc.id]: { content, candidates: findCandidates(content, doc.path) } }));
    } catch (e) {
      setLoaded((l) => ({ ...l, [doc.id]: { ...l[doc.id], error: String((e as Error)?.message ?? e) } }));
    } finally {
      setBusy('');
    }
  };

  const label = (c: Candidate) => {
    switch (c.target.type) {
      case 'household':
        return `${t(c.target.side === 'income' ? 'income' : 'expenses')} · ${t(c.target.key as TKey)}`;
      case 'birthDate':
        return t('field_birthDate');
      case 'childBirthYear':
        return t('field_children');
      case 'name':
        return t('field_name');
    }
  };
  const valueText = (c: Candidate) =>
    c.target.type === 'household'
      ? `${fmt.eur(Number(c.value))} / ${t('monthly').toLowerCase()}`
      : c.target.type === 'birthDate'
        ? new Date(String(c.value)).toLocaleDateString()
        : String(c.value);

  const apply = (cs: Candidate[]) => {
    let s = state;
    for (const c of cs) s = applyCandidate(s, c);
    setState(s);
    setApplied((a) => new Set([...a, ...cs.map((c) => c.id)]));
  };

  const open = cur?.candidates.filter((c) => !applied.has(c.id)) ?? [];
  const canOcr = doc && (doc.kind === 'image' || (doc.kind === 'pdf' && cur?.content?.scanned));
  const tables = cur?.content?.tables;

  if (docs.length === 0) return <div className="docs-empty">{t('docEmpty')}</div>;

  return (
    <div className="docs">
      <ul className="doc-list">
        {docs.map((d) => (
          <li key={d.id}>
            <button className={d.id === selected ? 'on' : ''} onClick={() => setSelected(d.id)} title={d.path}>
              <span className="doc-icon">{ICON[d.kind]}</span>
              <span className="doc-name">{d.path}</span>
              <span className="doc-size">{sizeLabel(d.size)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="doc-view">
        {doc && (
          <>
            <div className="doc-head">
              <h2>
                {ICON[doc.kind]} {doc.name}
              </h2>
              {canOcr && (
                <button className="btn" disabled={!!busy} onClick={runOcr} title={t('docOcrHint')}>
                  {t('docOcr')}
                </button>
              )}
            </div>
            {busy && <div className="hint">{busy}</div>}
            {cur?.error && <div className="warnings">⚠ {cur.error}</div>}

            {cur?.content && (
              <div className="doc-body">
                <div className="doc-preview">
                  {doc.kind === 'image' && cur.content.url && <img src={cur.content.url} alt={doc.name} />}
                  {doc.kind === 'pdf' && cur.content.url && <iframe src={cur.content.url} title={doc.name} />}
                  {cur.content.html && (
                    // mammoth produces plain structural HTML (headings, paragraphs, tables, images)
                    <div className="doc-html" dangerouslySetInnerHTML={{ __html: cur.content.html }} />
                  )}
                  {tables && tables.length > 0 && (
                    <>
                      {tables.length > 1 && (
                        <div className="tabs sheets">
                          {tables.map((tb, i) => (
                            <button key={tb.name} className={i === sheet ? 'on' : ''} onClick={() => setSheet(i)}>
                              {tb.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="doc-table">
                        <table>
                          <tbody>
                            {tables[sheet]?.rows.map((r, i) => (
                              <tr key={i}>
                                {r.map((c, j) => (
                                  <td key={j}>{typeof c === 'number' ? c.toLocaleString() : c}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {cur.content.slides?.map((s, i) => (
                    <div className="doc-slide" key={i}>
                      <b>
                        {t('docSlides')} {i + 1}
                      </b>
                      <pre>{s}</pre>
                    </div>
                  ))}
                  {(doc.kind === 'text' || doc.kind === 'json') && <pre className="doc-text">{cur.content.text}</pre>}
                  {doc.kind === 'other' && <div className="hint">{t('docUnsupported')}</div>}
                  {doc.kind === 'image' && !cur.content.url && <div className="hint">{t('docUnsupported')}</div>}
                </div>

                <aside className="doc-found">
                  <h3>{t('docFound')}</h3>
                  {cur.candidates.length === 0 && <p className="hint">{t('docNoValues')}</p>}
                  {open.length > 1 && (
                    <button className="btn primary" onClick={() => apply(open)}>
                      {t('docApplyAll')} ({open.length})
                    </button>
                  )}
                  <ul>
                    {cur.candidates.map((c) => (
                      <li key={c.id} className={applied.has(c.id) ? 'done' : ''}>
                        <div className="cand-label">{label(c)}</div>
                        <div className="cand-value">{valueText(c)}</div>
                        <div className="cand-context" title={c.context}>
                          „{c.context.slice(0, 90)}“
                        </div>
                        {applied.has(c.id) ? (
                          <span className="ok-text">✓ {t('docApplied')}</span>
                        ) : (
                          <button className="btn ghost" onClick={() => apply([c])}>
                            {t('docApply')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {cur.content.text && doc.kind !== 'text' && doc.kind !== 'json' && (
                    <details className="doc-raw">
                      <summary>{t('docText')}</summary>
                      <pre>{cur.content.text.slice(0, 20000)}</pre>
                    </details>
                  )}
                  {canOcr && <p className="hint">{t('docOcrHint')}</p>}
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
