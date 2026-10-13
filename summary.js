// Résumé simple d'une leçon : on repère les phrases les plus importantes (sans intelligence artificielle).
// Il fonctionne hors ligne et ne change jamais la leçon d'origine.
import { norm } from './db.js';

const STOP = new Set(('le la les un une des de du d l et ou mais donc or ni car que qui quoi dont ou ce cet cette ces se sa son ses leur leurs mon ma mes ton ta tes notre nos votre vos ' +
  'il elle ils elles on nous vous je tu me te lui eux y en au aux a est sont ete etre avoir ai as avons avez ont avait avaient sera seront fait faire peut peuvent plus moins tres aussi comme ' +
  'par pour sur sous dans avec sans entre vers chez si ne pas non oui ainsi alors lorsque quand puis tout tous toute toutes autre autres meme memes quel quelle quels quelles cela ceci celui celle ceux celles soit ' +
  'etc exemple exemples').split(' ').map(norm));

const stem = (w) => (w.length > 4 ? w.replace(/(es|s|x|e)$/, '') : w);
const tokens = (t) => norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
const KEY_SECTION = /retenir|important|essentiel|resume|conclusion|bilan|definition/;
const DEFINITION = /\b(est|sont|designe|appelle|appelee?s?|definit|correspond|signifie|permet|consiste|represente)\b/;
const clean = (t) => t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// Découpe la leçon en titres, éléments de liste et phrases
export function units(text) {
  const out = [];
  let section = '';
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,3}\s+(.*)/);
    if (h) { section = clean(h[1]); out.push({ kind: 'h', text: section, section }); continue; }
    const li = line.match(/^[-•]\s+(.*)/);
    if (li) { out.push({ kind: 'li', text: li[1], section }); continue; }
    for (const s of line.split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÙÛÇ0-9])/u)) if (s.trim().length > 1) out.push({ kind: 's', text: s.trim(), section });
  }
  return out.map((u, i) => ({ ...u, i }));
}

const overlap = (a, b) => {
  const A = new Set(tokens(a).map(stem)), B = new Set(tokens(b).map(stem));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / Math.min(A.size, B.size);
};

// Deux phrases presque identiques ne sont pas répétées (mesure de ressemblance : mots communs / mots au total)
const similar = (a, b) => {
  const A = new Set(tokens(a).map(stem)), B = new Set(tokens(b).map(stem));
  if (A.size < 3 || B.size < 3) return false;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n) > 0.6;
};

// level : 1 = court, 2 = moyen, 3 = détaillé
export function summarize(title, text, level = 2) {
  const all = units(text);
  const body = all.filter((u) => u.kind !== 'h');
  const wordCount = body.reduce((n, u) => n + u.text.split(/\s+/).length, 0);
  if (body.length < 4 || wordCount < 45) return null;

  const tf = new Map();
  for (const u of all) for (const w of tokens(u.text).map(stem)) tf.set(w, (tf.get(w) || 0) + (u.kind === 'h' ? 2 : 1));
  const titleWords = new Set(tokens(title).map(stem));

  const firstOfSection = new Set();
  const seen = new Set();
  for (const u of body) if (!seen.has(u.section)) { seen.add(u.section); firstOfSection.add(u.i); }

  const score = (u) => {
    const ws = tokens(u.text).map(stem);
    let s = ws.reduce((n, w) => n + (tf.get(w) || 0), 0) / Math.sqrt(ws.length || 1);
    s += ws.filter((w) => titleWords.has(w)).length * 1.5;
    if (KEY_SECTION.test(norm(u.section))) s += 4;
    if (firstOfSection.has(u.i)) s += 2.5;
    if (DEFINITION.test(norm(u.text))) s += 2;
    if (/=|\d{4}|\d+\s?[a-zA-Zµ°%Ω]|\*\*/.test(u.text)) s += 1.5;
    if (u.text.includes('=') && u.text.length < 90) s += 2;                 // une formule courte est souvent l'essentiel
    if (/exemple/.test(norm(u.section))) s -= 3;                            // un exemple illustre, il ne résume pas
    if (overlap(u.section, title) > 0.3) s += 3;                            // la partie qui porte le nom de la leçon
    if (/:\s*$/.test(u.text)) s -= 4;                                       // « Quand un microbe entre : » annonce, mais ne dit rien
    if (u.text.length < 25) s -= 2;
    if (u.text.length > 260) s -= 1;
    return s;
  };
  const scored = body.map((u) => ({ ...u, score: score(u) }));

  const ratio = { 1: 0.2, 2: 0.45, 3: 0.65 }[level] || 0.45;
  const minK = { 1: 3, 2: 4, 3: 6 }[level] || 4;
  const k = Math.min(body.length, Math.max(minK, Math.min(14, Math.round(body.length * ratio))));
  const chosen = [];
  const take = (u) => {
    if (!u || chosen.some((c) => c.i === u.i) || chosen.some((c) => similar(c.text, u.text))) return false;
    chosen.push(u);
    return true;
  };
  // les parties « À retenir », « Bilan »… sont déjà un résumé : on les garde presque entières
  const keyUnits = scored.filter((u) => u.section && KEY_SECTION.test(norm(u.section)) && u.kind !== 'h');
  if (level >= 2) keyUnits.slice(0, 6).forEach(take);
  else [...keyUnits].sort((a, b) => b.score - a.score).slice(0, 2).forEach(take);
  // d'abord le meilleur élément de chaque partie (pour couvrir toute la leçon), puis les meilleurs restants
  const bySection = new Map();
  for (const u of scored) if (!bySection.has(u.section) || u.score > bySection.get(u.section).score) bySection.set(u.section, u);
  for (const u of [...bySection.values()].sort((a, b) => b.score - a.score)) if (chosen.length < k) take(u);
  for (const u of [...scored].sort((a, b) => b.score - a.score)) if (chosen.length < k) take(u);
  chosen.sort((a, b) => a.i - b.i);

  // mots-clés : les mots les plus fréquents, affichés sous leur forme d'origine
  const forms = new Map();
  for (const u of all) for (const raw of u.text.split(/[^\p{L}\p{N}]+/u)) {
    const w = tokens(raw)[0];
    if (!w) continue;
    const st = stem(w);
    const m = forms.get(st) || new Map();
    m.set(raw.toLowerCase(), (m.get(raw.toLowerCase()) || 0) + 1);
    forms.set(st, m);
  }
  const keywords = [...tf.entries()].filter(([w]) => forms.has(w) && w.length > 3 && !/^\d+$/.test(w)).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([w]) => [...forms.get(w).entries()].sort((a, b) => b[1] - a[1])[0][0]);

  // regroupe par partie, dans l'ordre de la leçon
  const groups = [];
  for (const u of chosen) {
    let g = groups[groups.length - 1];
    if (!g || g.section !== u.section) { g = { section: u.section, items: [] }; groups.push(g); }
    g.items.push(clean(u.text));
  }
  return { groups, keywords, count: chosen.length, total: body.length };
}

export function toMarkdown(title, r) {
  const lines = [`# Résumé : ${title}`];
  if (r.keywords.length) lines.push(`Mots-clés : ${r.keywords.join(', ')}.`);
  for (const g of r.groups) {
    if (g.section) lines.push(`## ${g.section}`);
    for (const it of g.items) lines.push(`- ${it}`);
  }
  return lines.join('\n');
}
