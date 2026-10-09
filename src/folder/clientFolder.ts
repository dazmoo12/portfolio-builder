// Client folder access via the File System Access API (Edge/Chrome).
// Works with OneDrive-synced folders: files stay on the machine, nothing is uploaded.

import { kindOf, type ClientDoc } from '../documents/readers';
import { migrateState, type AppState } from '../state';

export const PORTFOLIO_FILE = 'portfolio.json';

// Minimal typings – the File System Access API is not yet part of TypeScript's DOM lib.
interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
}
interface FsDirHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FsFileHandle | FsDirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
}
export type ClientFolder = FsDirHandle;

export function folderSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickFolder(): Promise<ClientFolder> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<FsDirHandle> }).showDirectoryPicker;
  return picker({ id: 'client-folder', mode: 'readwrite' });
}

/** Lists files (two levels deep, max. 300) as readable client documents. */
export async function listFiles(dir: ClientFolder, prefix = '', depth = 0, out: ClientDoc[] = []): Promise<ClientDoc[]> {
  for await (const entry of dir.values()) {
    if (out.length >= 300) break;
    if (entry.kind === 'file') {
      if (entry.name.startsWith('~$') || entry.name.startsWith('.')) continue; // Office lock files, hidden files
      const path = prefix + entry.name;
      out.push({ id: path, path, name: entry.name, size: (await entry.getFile()).size, kind: kindOf(entry.name), getFile: () => entry.getFile() });
    } else if (depth < 1) {
      await listFiles(entry, `${prefix}${entry.name}/`, depth + 1, out);
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Uploaded files (file picker, folder upload or drag & drop) as client documents. */
export function filesToDocs(files: File[]): ClientDoc[] {
  return files
    .filter((f) => !f.name.startsWith('~$') && !f.name.startsWith('.'))
    .map((f) => {
      const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      return { id: `${path}-${f.size}-${f.lastModified}`, path, name: f.name, size: f.size, kind: kindOf(f.name), getFile: async () => f };
    });
}

/** Reads portfolio.json from the folder; null if missing or invalid. */
export async function readPortfolio(dir: ClientFolder): Promise<AppState | null> {
  try {
    const handle = await dir.getFileHandle(PORTFOLIO_FILE);
    return migrateState(JSON.parse(await (await handle.getFile()).text()));
  } catch {
    return null;
  }
}

export async function writeFile(dir: ClientFolder, name: string, data: Blob | string) {
  const handle = await dir.getFileHandle(name, { create: true });
  const w = await handle.createWritable();
  await w.write(data);
  await w.close();
}

export function writePortfolio(dir: ClientFolder, state: AppState) {
  return writeFile(dir, PORTFOLIO_FILE, JSON.stringify(state, null, 2));
}

/** Fallback when no folder is open: regular browser download. */
export function download(name: string, data: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
