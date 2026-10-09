// Creates a fictional demo client folder for testing the document import:
//   npx vite-node scripts/make-demo-folder.ts
// All names and numbers are made up.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';

const dir = join('demo', 'Kundenordner_Anna_Beispiel');
mkdirSync(join(dir, 'Gehalt'), { recursive: true });
mkdirSync(join(dir, 'Verträge'), { recursive: true });

// --- PDF with text layer (payslip) – minimal hand-written PDF, WinAnsi encoding for umlauts/€ ---
function pdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = ['BT', '/F1 11 Tf', '14 TL', '60 780 Td', ...lines.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // € is 0x80 in WinAnsi
  return Buffer.from(out.replace(/€/g, '\x80'), 'latin1');
}
writeFileSync(
  join(dir, 'Gehalt', 'Gehaltsabrechnung_09_2026.pdf'),
  pdf([
    'Musterfirma GmbH - Gehaltsabrechnung September 2026',
    'Mitarbeiterin: Anna Beispiel, geboren am 12.02.1994',
    '',
    'Gesamtbrutto                      4.800,00 €',
    'Lohnsteuer                          712,33 €',
    'Rentenversicherung                  446,40 €',
    'Krankenversicherung                 410,40 €',
    'Pflegeversicherung                   86,40 €',
    'Arbeitslosenversicherung             62,40 €',
    'Auszahlungsbetrag                 3.082,07 €',
  ]),
);

// --- Word (rental contract) – minimal DOCX ---
async function docx(paragraphs: string[]) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}
writeFileSync(
  join(dir, 'Verträge', 'Mietvertrag.docx'),
  await docx([
    'Mietvertrag über Wohnraum',
    'Mieterin: Anna Beispiel',
    'Mietobjekt: Musterstraße 12, 12345 Musterstadt, 3 Zimmer',
    'Kaltmiete monatlich: 890,00 €',
    'Nebenkosten-Vorauszahlung monatlich: 210,00 €',
    'Kaution: 2.670,00 €',
  ]),
);

// --- Excel (household budget kept by the client, free format) ---
const budget = XLSX.utils.aoa_to_sheet([
  ['Unser Haushaltsbuch 2026', ''],
  ['Position', 'Betrag pro Monat'],
  ['Kindergeld Lena', 255],
  ['Lebensmittel', 620],
  ['Handy + Internet', 65],
  ['Auto (Versicherung, Tanken)', 240],
  ['Fitnessstudio', 35],
  ['Urlaub (Rücklage)', 150],
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, budget, 'Haushalt');
writeFileSync(join(dir, 'Haushaltsbuch.xlsx'), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

// --- PowerPoint (old proposal) ---
const p = new PptxGenJS();
p.addSlide().addText('Beratungsgespräch Anna Beispiel – Notizen', { x: 0.5, y: 0.5, w: 9, h: 1 });
p.addSlide().addText('Kind: Lena, geb. 03.05.2021\nBausparvertrag monatlich 50,00 €', { x: 0.5, y: 0.5, w: 9, h: 2 });
writeFileSync(join(dir, 'Beratung_2025.pptx'), Buffer.from((await p.write({ outputType: 'nodebuffer' })) as ArrayBuffer));

console.log('demo folder written to', dir);
