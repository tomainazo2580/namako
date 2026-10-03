// Import de PDF et scan de cours (OCR). Les bibliothèques sont téléchargées à la première
// utilisation, puis gardées sur le téléphone par sw.js pour fonctionner hors ligne.
const PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESS_JS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const LANG_PATH = 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@4.1.0';
const MAX_PDF_PAGES = 100;
const MAX_OCR_PDF_PAGES = 15;
const MAX_SIDE = 2400;
const OFFLINE = 'Téléchargement impossible. Vérifiez votre connexion Internet : elle est nécessaire la première fois.';

let worker = null;
let cancelled = false;
let abort = null;
let abortNow = null;
let onPct = () => {};
const scripts = {};

export const tidy = (t) => t.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function begin() {
  cancelled = false;
  abort = new Promise((_, reject) => { abortNow = () => reject(new Error('annulé')); });
  abort.catch(() => {});
}
export function cancel() {
  cancelled = true;
  if (abortNow) abortNow();
  if (worker) { worker.terminate(); worker = null; }
}
const check = () => { if (cancelled) throw new Error('annulé'); };
const run = (promise) => Promise.race([promise, abort]);

function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => { delete scripts[src]; reject(new Error(OFFLINE)); };
      document.head.append(s);
    });
  }
  return scripts[src];
}

/* ---------- PDF ---------- */

async function loadPdfJs() {
  await loadScript(PDF_JS);
  const lib = window.pdfjsLib;
  if (!lib.GlobalWorkerOptions.workerSrc) {
    // Le script du lecteur est lu en mode « CORS » pour pouvoir être conservé hors ligne
    const code = await fetch(PDF_WORKER).then((r) => r.text()).catch(() => { throw new Error(OFFLINE); });
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  return lib;
}

async function openPdf(file) {
  const lib = await run(loadPdfJs());
  try { return await run(lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise); }
  catch (e) { if (e.message === 'annulé') throw e; throw new Error('Ce PDF est protégé ou illisible.'); }
}

async function pageText(page) {
  const tc = await page.getTextContent();
  return tc.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join('');
}

// PDF qui contient du texte : on le lit directement. Renvoie '' si c'est un scan sans texte.
export async function importPdf(file, onProgress) {
  begin();
  onProgress('Ouverture du PDF…', 0);
  const pdf = await openPdf(file);
  const n = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts = [];
  for (let i = 1; i <= n; i++) {
    check();
    onProgress(`Lecture de la page ${i} sur ${n}`, (i - 1) / n);
    parts.push(await run(pageText(await pdf.getPage(i))));
  }
  return tidy(parts.join('\n\n'));
}

/* ---------- OCR (lecture d'images) ---------- */

async function getWorker() {
  await loadScript(TESS_JS);
  if (!worker) {
    try {
      worker = await window.Tesseract.createWorker('fra', 1, {
        langPath: LANG_PATH,
        gzip: false,
        logger: (m) => { if (m.status === 'recognizing text') onPct(m.progress); },
      });
    } catch {
      worker = null;
      throw new Error('Le module de scan n’a pas pu démarrer. Si c’est la première fois, vérifiez votre connexion Internet.');
    }
  }
  return worker;
}

async function finish() {
  if (worker) { const w = worker; worker = null; try { await w.terminate(); } catch { /* déjà arrêté */ } }
}

// Réduit la photo, la passe en niveaux de gris et renforce le contraste pour aider la lecture
async function prepare(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error('Cette image ne peut pas être lue. Essayez une photo au format JPG ou PNG.'); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.35)';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (bmp.close) bmp.close();
  return canvas;
}

async function recognize(canvas) {
  const w = await run(getWorker());
  const { data } = await run(w.recognize(canvas));
  return data.text;
}

export async function ocrImages(files, onProgress) {
  begin();
  const parts = [];
  try {
    for (let i = 0; i < files.length; i++) {
      check();
      const label = files.length > 1 ? `Lecture de la photo ${i + 1} sur ${files.length}` : 'Lecture du texte de la photo';
      onProgress(i === 0 ? 'Préparation du module de scan…' : label, i / files.length);
      const canvas = await prepare(files[i]);
      onPct = (p) => onProgress(label, (i + p) / files.length);
      parts.push(await recognize(canvas));
    }
  } finally { await finish(); }
  return tidy(parts.join('\n\n'));
}

// PDF scanné (sans texte) : chaque page est dessinée puis lue par le module de scan
export async function ocrPdf(file, onProgress) {
  begin();
  const parts = [];
  try {
    const pdf = await openPdf(file);
    const n = Math.min(pdf.numPages, MAX_OCR_PDF_PAGES);
    for (let i = 1; i <= n; i++) {
      check();
      const label = `Lecture de la page ${i} sur ${n}`;
      onProgress(i === 1 ? 'Préparation du module de scan…' : label, (i - 1) / n);
      const page = await run(pdf.getPage(i));
      const vp = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      await run(page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise);
      onPct = (p) => onProgress(label, (i - 1 + p) / n);
      parts.push(await recognize(canvas));
    }
  } finally { await finish(); }
  return tidy(parts.join('\n\n'));
}
