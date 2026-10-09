// Reading client documents in the browser. Heavy libraries are loaded on demand,
// and nothing is sent anywhere: all parsing happens locally.

import JSZip from 'jszip';

export type DocKind = 'image' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'text' | 'json' | 'other';

export interface ClientDoc {
  id: string;
  /** Path relative to the client folder (or the file name for uploads). */
  path: string;
  name: string;
  size: number;
  kind: DocKind;
  getFile: () => Promise<File>;
}

export interface DocTable {
  name: string;
  rows: (string | number)[][];
}

export interface DocContent {
  /** Plain text (all readers that can provide it). */
  text: string;
  /** Object URL for images and PDFs (preview). */
  url?: string;
  /** Formatted Word content. */
  html?: string;
  /** Excel / CSV sheets. */
  tables?: DocTable[];
  /** PowerPoint text per slide. */
  slides?: string[];
  /** PDF without a text layer (scan) – OCR can help. */
  scanned?: boolean;
}

const EXT: Record<string, DocKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', tif: 'image', tiff: 'image', heic: 'image',
  pdf: 'pdf',
  docx: 'word', doc: 'word',
  xlsx: 'excel', xlsm: 'excel', xls: 'excel', csv: 'excel', ods: 'excel',
  pptx: 'powerpoint', ppt: 'powerpoint',
  txt: 'text', md: 'text',
  json: 'json',
};

export function kindOf(name: string): DocKind {
  return EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'other';
}

/** Browsers can display these image types directly. */
const PREVIEWABLE_IMAGES = /\.(jpe?g|png|gif|webp|bmp)$/i;

export async function readDoc(doc: ClientDoc): Promise<DocContent> {
  const file = await doc.getFile();
  switch (doc.kind) {
    case 'image':
      return { text: '', url: PREVIEWABLE_IMAGES.test(doc.name) ? URL.createObjectURL(file) : undefined };
    case 'pdf':
      return readPdf(file);
    case 'word':
      return readWord(file, doc.name);
    case 'excel':
      return readExcel(file);
    case 'powerpoint':
      return readPowerPoint(file, doc.name);
    case 'text':
    case 'json':
      return { text: await file.text() };
    default:
      return { text: '' };
  }
}

// ---------- PDF (pdf.js) ----------

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

async function readPdf(file: File): Promise<DocContent> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    // keep the line structure: pdf.js marks line ends with hasEOL
    pages.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''));
  }
  const text = pages.join('\n\n').replace(/[ \t]+\n/g, '\n');
  return { text, url: URL.createObjectURL(file), scanned: text.replace(/\s/g, '').length < 20 * pdf.numPages };
}

/** Renders PDF pages to canvases (for OCR of scanned documents). */
export async function pdfToCanvases(file: File, maxPages = 5): Promise<HTMLCanvasElement[]> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    out.push(canvas);
  }
  return out;
}

// ---------- Word (mammoth) ----------

async function readWord(file: File, name: string): Promise<DocContent> {
  if (!/\.docx$/i.test(name)) return { text: '' }; // legacy .doc is not readable in the browser
  const { default: mammoth } = await import('mammoth/mammoth.browser');
  const arrayBuffer = await file.arrayBuffer();
  const [html, raw] = await Promise.all([mammoth.convertToHtml({ arrayBuffer }), mammoth.extractRawText({ arrayBuffer })]);
  return { text: raw.value, html: html.value };
}

// ---------- Excel / CSV (SheetJS) ----------

async function readExcel(file: File): Promise<DocContent> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const tables: DocTable[] = wb.SheetNames.slice(0, 10).map((sheet) => ({
    name: sheet,
    rows: (XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, blankrows: false }) as unknown[][])
      .slice(0, 300)
      .map((r) => r.slice(0, 30).map((c) => (c instanceof Date ? c.toLocaleDateString('de-DE') : typeof c === 'number' ? c : String(c ?? '')))),
  }));
  const text = tables.map((t) => t.rows.map((r) => r.join('\t')).join('\n')).join('\n\n');
  return { text, tables };
}

// ---------- PowerPoint (slide XML) ----------

async function readPowerPoint(file: File, name: string): Promise<DocContent> {
  if (!/\.pptx$/i.test(name)) return { text: '' }; // legacy .ppt is not readable in the browser
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const slides: string[] = [];
  for (const p of slidePaths) {
    const xml = await zip.file(p)!.async('string');
    // one line per paragraph, text runs joined
    const paras = xml.split(/<\/a:p>/).map((para) => [...para.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(''));
    slides.push(paras.filter((x) => x.trim()).join('\n'));
  }
  return { text: slides.join('\n\n'), slides };
}

function decodeXml(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// ---------- OCR (tesseract.js) ----------

/**
 * Text recognition for images and scanned PDFs. Runs locally in a web worker;
 * only the language model is downloaded (once, then cached by the browser).
 */
export async function ocr(sources: (File | HTMLCanvasElement)[], onProgress: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['deu', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  try {
    const texts: string[] = [];
    for (const src of sources) texts.push((await worker.recognize(src)).data.text);
    return texts.join('\n\n');
  } finally {
    await worker.terminate();
  }
}
