// Saved clients in this browser: open a previous client or delete one.

import { useState } from 'react';
import { deleteClient, listClients } from '../clients';
import type { Format, T } from '../i18n';
import { migrateState, type AppState } from '../state';
import { Section } from './Settings';

interface Props {
  t: T;
  fmt: Format;
  state: AppState;
  onOpen: (s: AppState) => void;
}

export function ClientsSection({ t, fmt, state, onOpen }: Props) {
  const [, refresh] = useState(0);
  const [query, setQuery] = useState('');
  const all = listClients<AppState>();
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((c) => (c.name || t('unnamedClient')).toLowerCase().includes(q)) : all;
  return (
    <Section title={`${t('secClients')}${all.length ? ` (${all.length})` : ''}`} defaultOpen={false}>
      <p className="hint">{t('clientsHint')}</p>
      {all.length > 6 && <input className="clients-search" type="search" placeholder="…" value={query} onChange={(e) => setQuery(e.target.value)} />}
      {all.length === 0 && <p className="hint">{t('noSavedClients')}</p>}
      <ul className="clients">
        {shown.map((c) => {
          const current = c.id === state.clientId;
          return (
            <li key={c.id} className={current ? 'current' : ''}>
              <div>
                <b>{c.name || t('unnamedClient')}</b>
                <span>
                  {fmt.date(c.savedAt.slice(0, 10))} {c.savedAt.slice(11, 16)}
                  {current && ` · ${t('currentClient')}`}
                </span>
              </div>
              {!current && (
                <button
                  className="btn ghost small"
                  onClick={() => {
                    const s = migrateState(c.state);
                    if (s) onOpen({ ...s, clientId: c.id });
                  }}
                >
                  {t('openClient')}
                </button>
              )}
              <button
                className="icon"
                aria-label={t('deleteClient')}
                title={t('deleteClient')}
                disabled={current}
                onClick={() => {
                  if (!window.confirm(t('confirmDeleteClient', { name: c.name || t('unnamedClient') }))) return;
                  deleteClient(c.id);
                  refresh((n) => n + 1);
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">{t('savedClientNote')}</p>
    </Section>
  );
}
