import { describe, expect, it } from 'vitest';
import type { Client } from '../engine/types';
import { assignBirthDates, isIdDoc } from './birthScan';
import type { ClientDoc } from './readers';

const today = new Date('2026-11-06T12:00:00');
const client: Client = { name: 'Erika Mustermann', age: 40, children: [], adults: [] };
const hit = (date: string, nearby: string) => ({ date, source: 'Ausweis.jpg', nearby });

describe('assigning dates of birth', () => {
  it('enters the date next to the client name', () => {
    const r = assignBirthDates(client, [hit('1983-08-12', 'MUSTERMANN\nERIKA')], today);
    expect(r.client.birthDate).toBe('1983-08-12');
    expect(r.client.age).toBe(43);
    expect(r.unclear).toBe(false);
  });

  it('accepts a single adult date for a single adult, even if the name was misread', () => {
    const r = assignBirthDates(client, [hit('1983-08-12', 'MUST3RMANN')], today);
    expect(r.client.birthDate).toBe('1983-08-12');
  });

  it('ignores children', () => {
    const r = assignBirthDates(client, [hit('2019-05-03', 'MUSTERMANN LENA')], today);
    expect(r.client.birthDate).toBeUndefined();
    expect(r.unclear).toBe(false);
  });

  it('does not guess between two different adult dates', () => {
    const r = assignBirthDates(client, [hit('1983-08-12', 'X'), hit('1980-01-01', 'Y')], today);
    expect(r.client.birthDate).toBeUndefined();
    expect(r.unclear).toBe(true);
  });

  it('assigns each adult by name, also with the same surname', () => {
    const family = { ...client, adults: [{ id: 'm', name: 'Max Mustermann', age: 40 }, { id: 'l', name: 'Lena Mustermann', age: 19 }] };
    const r = assignBirthDates(family, [hit('1983-08-12', 'ERIKA MUSTERMANN'), hit('1980-01-01', 'MAX MUSTERMANN'), hit('2005-02-02', 'LENA MUSTERMANN')], today);
    expect(r.client.birthDate).toBe('1983-08-12');
    expect(r.client.adults.map((a) => a.birthDate)).toEqual(['1980-01-01', '2005-02-02']);
    expect(r.applied).toHaveLength(3);
  });

  it('does not guess between a couple without a name match', () => {
    const couple = { ...client, adults: [{ id: 'm', name: 'Max Mustermann', age: 40 }] };
    const r = assignBirthDates(couple, [hit('1983-08-12', 'unlesbar')], today);
    expect(r.applied).toHaveLength(0);
    expect(r.unclear).toBe(true);
  });

  it('never overwrites an existing date', () => {
    const r = assignBirthDates({ ...client, birthDate: '1990-02-02' }, [hit('1983-08-12', 'ERIKA MUSTERMANN')], today);
    expect(r.client.birthDate).toBe('1990-02-02');
    expect(r.applied).toHaveLength(0);
  });

  it('copes with umlauts spelled out in machine-readable lines', () => {
    const r = assignBirthDates({ ...client, name: 'Jürgen Müller' }, [hit('1983-08-12', 'MUELLER<<JUERGEN')], today);
    expect(r.client.birthDate).toBe('1983-08-12');
  });
});

describe('ID document detection', () => {
  const doc = (path: string) => ({ path }) as ClientDoc;
  it('recognises typical file names', () => {
    for (const p of ['Personalausweis.jpg', 'Ausweis/vorne.png', 'Scan_ID_Anna.pdf', 'Reisepass.pdf', 'Perso Rückseite.jpg', 'pass.png']) expect(isIdDoc(doc(p))).toBe(true);
  });
  it('leaves other files out', () => {
    for (const p of ['Passwort.txt', 'Kompass.pdf', 'Rapid.pdf', 'Gehaltsabrechnung.pdf']) expect(isIdDoc(doc(p))).toBe(false);
  });
});
