import { useRef, useState } from 'react';
import { autoImport } from '../documents/autoImport';
import type { ClientDoc } from '../documents/readers';
import { downloadTemplate } from '../documents/template';
import { filesToDocs, folderSupported, listFiles, pickFolder, writePortfolio, type ClientFolder } from '../folder/clientFolder';
import type { T } from '../i18n';
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
  const filesInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const fail = (e: unknown) => {
    if ((e as DOMException)?.name !== 'AbortError') setError(e instanceof Error ? e.message : String(e));
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
      setState(res.state);
      setDocs([...docs.filter((d) => !added.some((a) => a.id === d.id)), ...added]);
      setMsgs(res.messages);
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
