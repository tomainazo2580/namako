// Correcteur d'orthographe français intégré (dictionnaire téléchargé une fois, puis conservé hors ligne).
// Il repère les mots inconnus et propose des corrections. Il ne vérifie pas la grammaire.
const WORDS_URL = 'https://cdn.jsdelivr.net/npm/an-array-of-french-words@2.0.0/index.json';
const ELISION = new Set(['l', 'd', 'j', 'n', 's', 'c', 'm', 't', 'qu', 'jusqu', 'lorsqu', 'puisqu', 'quoiqu', 'presqu']);
const EXTRA = new Set(["aujourd'hui", "quelqu'un", "quelqu'une", "presqu'île", "prud'homme"]);
const FAMILIES = ['aàâä', 'cç', 'eéèêë', 'iîï', 'oôö', 'uùûü', 'yÿ'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ';
const FAM = {};
for (const f of FAMILIES) for (const ch of f) FAM[ch] = f;

let set = null;
export const loaded = () => !!set;
export function release() { set = null; }

export async function load() {
  if (set) return;
  let list;
  try { list = await fetch(WORDS_URL).then((r) => { if (!r.ok) throw new Error('échec'); return r.json(); }); }
  catch { throw new Error('Téléchargement du dictionnaire impossible. Vérifiez votre connexion Internet : elle est nécessaire la première fois.'); }
  if (!Array.isArray(list) || list.length < 1000) throw new Error('Le dictionnaire reçu est invalide. Réessayez plus tard.');
  set = new Set(list);
}

const knownWord = (x) => {
  if (set.has(x)) return true;
  return x.includes('-') && x.split('-').every((p) => !p || set.has(p) || ELISION.has(p));
};
function isKnown(low) {
  if (EXTRA.has(low) || knownWord(low)) return true;
  const parts = low.split("'");
  return parts.length > 1 && parts.every((p, i) => (i < parts.length - 1 && ELISION.has(p)) || knownWord(p));
}

const sentenceStart = (text, i) => {
  let j = i - 1;
  while (j >= 0 && /[ \t«"(\-–•*#]/.test(text[j])) j--;
  return j < 0 || /[.!?\n:]/.test(text[j]);
};

// Renvoie les mots inconnus, sans les noms propres (majuscule en milieu de phrase) ni les sigles
export function findErrors(text, ignore = new Set()) {
  const out = new Map();
  for (const m of text.matchAll(/\p{L}+(?:['’-]\p{L}+)*/gu)) {
    const tok = m[0];
    const letters = tok.replace(/['’-]/g, '');
    if (letters.length < 2 || letters === letters.toUpperCase()) continue;
    if (tok[0] !== tok[0].toLowerCase() && !sentenceStart(text, m.index)) continue;
    const low = tok.toLowerCase().replace(/’/g, "'");
    if (ignore.has(low) || isKnown(low)) continue;
    if (out.has(low)) out.get(low).count++;
    else out.set(low, { word: tok, low, count: 1 });
  }
  return [...out.values()];
}

// Propositions : accents oubliés, lettres inversées, changées, en trop ou manquantes
export function suggest(word, max = 5) {
  const w = word.toLowerCase().replace(/’/g, "'");
  const out = [];
  const add = (c) => { if (c !== w && !out.includes(c) && isKnown(c)) out.push(c); };
  const chars = [...w];
  const n = chars.length;
  const slots = chars.map((ch) => FAM[ch] || ch);
  const combos = slots.reduce((k, s) => k * s.length, 1);
  if (combos > 1 && combos <= 4096) {
    let acc = [''];
    for (const s of slots) { const next = []; for (const a of acc) for (const ch of s) next.push(a + ch); acc = next; }
    acc.forEach(add);
  }
  for (let i = 0; i < n - 1; i++) { const c = chars.slice(); [c[i], c[i + 1]] = [c[i + 1], c[i]]; add(c.join('')); }
  for (let i = 0; i < n; i++) for (const l of LETTERS) { const c = chars.slice(); c[i] = l; add(c.join('')); }
  for (let i = 0; i < n; i++) add(chars.slice(0, i).join('') + chars.slice(i + 1).join(''));
  for (let i = 0; i <= n; i++) for (const l of LETTERS) add(chars.slice(0, i).join('') + l + chars.slice(i).join(''));
  const cap = word[0] !== word[0].toLowerCase();
  return out.slice(0, max).map((s) => (cap ? s[0].toUpperCase() + s.slice(1) : s));
}

// Remplace toutes les occurrences du mot (en gardant la majuscule initiale et le type d'apostrophe)
export function replaceAll(text, low, to) {
  const pat = low.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
  const re = new RegExp(`(?<![\\p{L}-])${pat}(?![\\p{L}-])`, 'giu');
  return text.replace(re, (m) => {
    const t = m.includes('’') ? to.replace(/'/g, '’') : to;
    return m[0] !== m[0].toLowerCase() ? t[0].toUpperCase() + t.slice(1) : t;
  });
}
