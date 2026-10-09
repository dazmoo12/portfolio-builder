// When a folder is opened or files are uploaded: load a saved portfolio.json and
// import filled-in client-data templates automatically.

import { PORTFOLIO_FILE } from '../folder/clientFolder';
import type { T } from '../i18n';
import { migrateState, type AppState } from '../state';
import { applyTemplate } from './apply';
import { readDoc, type ClientDoc } from './readers';
import { isTemplate, parseTemplate } from './template';

export async function autoImport(docs: ClientDoc[], state: AppState, t: T, opts: { allowPortfolio: boolean }) {
  let next = state;
  const messages: string[] = [];

  if (opts.allowPortfolio) {
    const pf = docs.find((d) => d.name.toLowerCase() === PORTFOLIO_FILE);
    if (pf) {
      const loaded = migrateState(JSON.parse(await (await pf.getFile()).text()));
      if (loaded) {
        next = loaded;
        messages.push(t('folderLoaded', { name: pf.path }));
      }
    }
  }

  for (const d of docs.filter((x) => x.kind === 'excel').slice(0, 20)) {
    try {
      const content = await readDoc(d);
      if (!isTemplate(content.tables)) continue;
      const data = parseTemplate(content.tables!);
      if (data && data.count > 0) {
        next = applyTemplate(next, data);
        messages.push(t('templateImported', { count: String(data.count), name: d.path }));
      }
    } catch {
      /* unreadable file – shown in the documents view */
    }
  }
  return { state: next, messages };
}
