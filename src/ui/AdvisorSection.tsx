import { useState } from 'react';
import { loadAdvisors, loadDefaultAdvisorId, saveAdvisors, saveDefaultAdvisorId, sameAdvisor, type AdvisorProfile } from '../advisors';
import { newUid } from '../catalog';
import type { T } from '../i18n';
import type { Advisor } from '../state';
import { Section } from './Settings';

interface Props {
  t: T;
  advisor: Advisor;
  onChange: (a: Advisor) => void;
}

export function AdvisorSection({ t, advisor, onChange }: Props) {
  const [profiles, setProfiles] = useState<AdvisorProfile[]>(loadAdvisors);
  const [defaultId, setDefaultId] = useState<string | null>(loadDefaultAdvisorId);
  const [msg, setMsg] = useState('');
  const current = profiles.find((p) => sameAdvisor(p, advisor));

  const persist = (list: AdvisorProfile[]) => {
    setProfiles(list);
    saveAdvisors(list);
  };
  const setDefault = (id: string | null) => {
    setDefaultId(id);
    saveDefaultAdvisorId(id);
  };

  return (
    <Section title={t('secAdvisor')} defaultOpen={profiles.length === 0}>
      {profiles.length > 0 && (
        <label className="field">
          <span>{t('advisorProfile')}</span>
          <select
            value={current?.id ?? ''}
            onChange={(e) => {
              const p = profiles.find((x) => x.id === e.target.value);
              if (p) onChange({ name: p.name, office: p.office, phone: p.phone, email: p.email });
            }}
          >
            {!current && <option value="">{t('advisorSelect')}</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === defaultId ? ` (${t('isDefault')})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {(['name', 'office', 'phone', 'email'] as const).map((k) => (
        <label className="field" key={k}>
          <span>{t(`advisor${k[0].toUpperCase()}${k.slice(1)}` as 'advisorName')}</span>
          <input value={advisor[k]} onChange={(e) => onChange({ ...advisor, [k]: e.target.value })} />
        </label>
      ))}
      <div className="upload-row">
        {!current && (
          <button
            className="btn"
            disabled={!advisor.name.trim()}
            onClick={() => {
              const p = { ...advisor, id: newUid() };
              persist([...profiles, p]);
              if (!defaultId) setDefault(p.id);
              setMsg(t('advisorSaved'));
            }}
          >
            {t('saveAdvisor')}
          </button>
        )}
        {current && current.id !== defaultId && (
          <button className="btn ghost" onClick={() => setDefault(current.id)}>
            {t('setDefaultAdvisor')}
          </button>
        )}
        {current && (
          <button
            className="btn ghost danger"
            onClick={() => {
              persist(profiles.filter((p) => p.id !== current.id));
              if (current.id === defaultId) setDefault(null);
            }}
          >
            {t('deleteAdvisor')}
          </button>
        )}
      </div>
      {msg && <div className="hint ok-text">{msg}</div>}
    </Section>
  );
}
