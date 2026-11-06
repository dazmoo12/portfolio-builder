// Finds the adults' dates of birth in a client folder: ID documents first, then readable
// documents, then other images. Runs locally in the background. A date is only entered if
// it can be assigned clearly – a wrong date of birth would be worse than a missing one.

import { ageOn, clientPeople, validBirthDate, type Person } from '../engine/person';
import type { Adult, Client } from '../engine/types';
import { findCandidates } from './extract';
import { hasBrowserImage, ocrDoc, readDocCached, type ClientDoc } from './readers';

export interface BirthHit {
  date: string;
  source: string;
  /** Text around the date, used to match it to a person by name. */
  nearby: string;
}

const ID_DOC = /ausweis|reisepass|passport|aufenthalt|identit|f(ü|ue)hrerschein|(^|[^a-zäöü])(perso|pass|id)([^a-zäöü]|$)/i;
const MAX_FILE_SIZE = 25_000_000;
const MAX_ID_DOCS = 12;
const MAX_OTHER_IMAGES = 6;

export const isIdDoc = (d: ClientDoc) => ID_DOC.test(d.path);

const readable = (d: ClientDoc) => d.size <= MAX_FILE_SIZE && ['pdf', 'word', 'excel', 'powerpoint', 'text'].includes(d.kind);
const ocrable = (d: ClientDoc) => d.size <= MAX_FILE_SIZE && ((d.kind === 'image' && hasBrowserImage(d.name)) || d.kind === 'pdf');

async function hitsIn(doc: ClientDoc, withOcr: boolean): Promise<BirthHit[]> {
  let content = await readDocCached(doc);
  if (withOcr && !content.text.trim() || withOcr && content.scanned) content = await ocrDoc(doc, content);
  return findCandidates(content, doc.path)
    .filter((c) => c.target.type === 'birthDate')
    .map((c) => ({ date: String(c.value), source: doc.path, nearby: c.nearby ?? c.context }));
}

export async function scanBirthDates(docs: ClientDoc[], onProgress: (file: string) => void, cancelled: () => boolean): Promise<BirthHit[]> {
  const hits: BirthHit[] = [];
  const run = async (list: ClientDoc[], withOcr: boolean, stopOnHit = false) => {
    for (const d of list) {
      if (cancelled() || (stopOnHit && hits.length)) return;
      onProgress(d.name);
      try {
        hits.push(...(await hitsIn(d, withOcr)));
      } catch {
        /* unreadable file – shown in the documents view */
      }
    }
  };
  const ids = docs.filter((d) => isIdDoc(d) && (readable(d) || ocrable(d))).slice(0, MAX_ID_DOCS);
  await run(ids, true);
  await run(docs.filter((d) => readable(d) && !ids.includes(d)), false);
  // the remaining images are slow to read, so stop as soon as something was found
  await run(docs.filter((d) => ocrable(d) && !ids.includes(d)).slice(0, MAX_OTHER_IMAGES), true, true);
  return hits;
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

const IGNORED_NAME_PARTS = new Set(['kunde', 'kundin', 'kundenordner', 'ordner', 'herr', 'frau']);

/** All parts of the person's name appear in the text. */
function nameIn(name: string, text: string) {
  const parts = normalize(name).split(/[^a-z]+/).filter((p) => p.length > 1 && !IGNORED_NAME_PARTS.has(p));
  const haystack = normalize(text);
  return parts.length > 0 && parts.every((p) => haystack.includes(p));
}

export interface BirthAssignment {
  client: Client;
  applied: { date: string; source: string; name: string }[];
  /** Dates were found, but not every adult could be assigned one with certainty. */
  unclear: boolean;
}

export function assignBirthDates(client: Client, hits: BirthHit[], today = new Date()): BirthAssignment {
  const people = clientPeople(client);
  const hasDate = (p: Person) => validBirthDate(p.birthDate, today);
  // children's documents are no candidates for the adults
  const adult = hits.filter((h) => validBirthDate(h.date, today) && ageOn(h.date, today) >= 18);
  const known = people.map((p) => p.birthDate);
  const open = adult.filter((h) => !known.includes(h.date));
  const onlyDate = (list: BirthHit[]) => (new Set(list.map((h) => h.date)).size === 1 ? list[0] : undefined);

  const applied: BirthAssignment['applied'] = [];
  const found = people.map((p) => {
    if (hasDate(p)) return p;
    // the name next to the date identifies the person; a single adult needs no name match
    const own = open.filter((h) => nameIn(p.name, h.nearby) && people.every((o) => o === p || !nameIn(o.name, h.nearby)));
    const hit = onlyDate(own) ?? (people.length === 1 ? onlyDate(open) : undefined);
    if (!hit) return p;
    applied.push({ date: hit.date, source: hit.source, name: p.name });
    return { ...p, birthDate: hit.date, age: ageOn(hit.date, today) };
  });

  const [first, ...others] = found;
  return {
    client: { ...client, ...first, adults: others as Adult[] },
    applied,
    unclear: found.some((p) => !hasDate(p)) && open.length > 0,
  };
}
