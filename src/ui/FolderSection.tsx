import { useRef, useState } from 'react';
import { assignBirthDates, scanBirthDates } from '../documents/birthScan';
import { autoImport } from '../documents/autoImport';
import type { ClientDoc } from '../documents/readers';
import { downloadTemplate } from '../documents/template';
import { missingBirthDate } from '../engine/person';
import { filesToDocs, folderSupported, listFiles, pickFolder, writePortfolio, type ClientFolder } from '../folder/clientFolder';
import { makeFormat, type T } from '../i18n';
import { newClientState, type AppState } from '../state';
import { Section } from './Settings';

interface Props {
  t: T;
  state: AppState;
  folder: ClientFolder | null;
  setFolder: (f: ClientFolder | null) => void;
  setState: (s: AppState) => void;
  docs: ClientDoc[];
  setDocs: (d: ClientDoc[]) => void;
  onShowDocs: () => void;
}

export function FolderSection({ t, state, folder, setFolder, setState, docs, setDocs, onShowDocs }: Props) {
  const [msgs, setMsgs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [scanning, setScanning] = useState('');
  // the search runs in the background: always work on the current state, stop if the client changed
  const latest = useRef({ state, docs });
  latest.current = { state, docs };
  const scanRun = useRef(0);
  const filesInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const fail = (e: unknown) => {
    if ((e as DOMException)?.name !== 'AbortError') setError(e instanceof Error ? e.message : String(e));
  };

  const findBirthDates = async (list: ClientDoc[]) => {
    const run = ++scanRun.current;
    const cancelled = () => run !== scanRun.current || !list.every((d) => latest.current.docs.some((x) => x.id === d.id));
    try {
      const hits = await scanBirthDates(list, (file) => setScanning(t('birthSearching', { file })), cancelled);
      if (cancelled()) return;
      const current = latest.current.state;
      if (!missingBirthDate(current.input.client)) return;
      const res = assignBirthDates(current.input.client, hits);
      if (res.applied.length) setState({ ...current, input: { ...current.input, client: res.client } });
      const fmt = makeFormat(current.uiLang);
      setMsgs((m) => [
        ...m,
        ...res.applied.map((a) => t('birthApplied', { name: a.name || t('field_name'), date: fmt.date(a.date), file: a.source })),
        ...(res.unclear ? [t('birthUnclear')] : []),
        ...(res.applied.length === 0 && !res.unclear ? [t('birthNotFound')] : []),
      ]);
    } finally {
      if (run === scanRun.current) setScanning('');
    }
  };

  const startSearch = (next: AppState, list: ClientDoc[]) => {
    if (missingBirthDate(next.input.client)) void findBirthDates(list);
  };

  const open = async () => {
    setError('');
    try {
      const dir = await pickFolder();
      const list = await listFiles(dir);
      const res = await autoImport(list, newClientState(state, dir.name), t, { allowPortfolio: true });
      setState(res.state);
      setFolder(dir);
      setDocs(list);
      setMsgs(res.messages.length ? res.messages : [t('folderEmpty', { name: dir.name })]);
      latest.current = { state: res.state, docs: list };
      startSearch(res.state, list);
    } catch (e) {
      fail(e);
    }
  };

  /** Uploaded files are added to the current client; a portfolio.json among them replaces the state. */
  const upload = async (files: File[]) => {
    setError('');
    try {
      const added = filesToDocs(files);
      const res = await autoImport(added, state, t, { allowPortfolio: true });
      const all = [...docs.filter((d) => !added.some((a) => a.id === d.id)), ...added];
      setState(res.state);
      setDocs(all);
      setMsgs(res.messages);
      latest.current = { state: res.state, docs: all };
      startSearch(res.state, added);
      onShowDocs();
    } catch (e) {
      fail(e);
    }
  };

  const save = async () => {
    if (!folder) return;
    setError('');
    try {
      await writePortfolio(folder, state);
      setMsgs([t('folderSaved', { name: `${folder.name}/portfolio.json` })]);
      setDocs(await listFiles(folder));
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Section title={t('secFolder')}>
      <p className="hint">{t('docPrivacy')}</p>
      {folderSupported() ? (
        <div className="upload-row">
          <button className="btn primary" onClick={open}>
            📁 {t('openFolder')}
          </button>
          {folder && (
            <>
              <button className="btn" onClick={save}>
                {t('saveToFolder')}
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setFolder(null);
                  setDocs([]);
                  setMsgs([]);
                }}
              >
                {t('closeFolder')}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="hint">{t('folderNotSupported')}</div>
      )}
      {folder && <div className="folder-name">📂 {folder.name}</div>}

      <div
        className={`dropzone ${drag ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload([...e.dataTransfer.files]);
        }}
      >
        <div className="upload-row">
          <button className="btn" onClick={() => filesInput.current?.click()}>
            {t('uploadFiles')}
          </button>
          <button className="btn" onClick={() => dirInput.current?.click()}>
            {t('uploadFolder')}
          </button>
        </div>
        <span className="hint">{t('dropHint')}</span>
      </div>
      <input
        ref={filesInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const f = [...(e.target.files ?? [])];
          e.target.value = '';
          if (f.length) upload(f);
        }}
      />
      <input
        ref={dirInput}
        type="file"
        hidden
        // folder upload works in all major browsers, also where folders cannot be opened for writing
        {...({ webkitdirectory: '', directory: '' } as object)}
        onChange={(e) => {
          const f = [...(e.target.files ?? [])];
          e.target.value = '';
          if (f.length) upload(f);
        }}
      />

      {msgs.map((m, i) => (
        <div key={i} className="hint ok-text">
          {m}
        </div>
      ))}
      {scanning && <div className="hint">{scanning}</div>}
      {error && <div className="warnings">⚠ {error}</div>}
      <div className="upload-row">
        {docs.length > 0 && (
          <button className="btn ghost" onClick={onShowDocs}>
            {t('secDocuments')} ({docs.length}) →
          </button>
        )}
        <button className="btn ghost" onClick={() => downloadTemplate(state, t)}>
          ⬇ {t('templateDownload')}
        </button>
      </div>
    </Section>
  );
}
