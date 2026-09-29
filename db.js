// Base locale (IndexedDB) et recherche. Aucune donnée ne quitte le téléphone.
const DB_NAME = 'namako';
const DB_VERSION = 1;
const TRASH_DAYS = 30;
let db;

export const state = { subjects: [], lessons: [], meta: {} };

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// minuscules + sans accents : "Électricité" -> "electricite"
export const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    // Les changements de structure futurs s'ajoutent ici (migration), sans jamais effacer les données.
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('subjects')) d.createObjectStore('subjects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('lessons')) d.createObjectStore('lessons', { keyPath: 'id' }).createIndex('subjectId', 'subjectId');
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function init() {
  db = await open();
  const t = db.transaction(['subjects', 'lessons', 'meta']);
  const [s, l, m] = await Promise.all([
    wrap(t.objectStore('subjects').getAll()),
    wrap(t.objectStore('lessons').getAll()),
    wrap(t.objectStore('meta').getAll()),
  ]);
  state.subjects = s;
  state.lessons = l;
  state.meta = Object.fromEntries(m.map((x) => [x.key, x.value]));
  await purgeTrash();
}

export async function putRaw(store, obj) {
  const t = db.transaction([store], 'readwrite');
  t.objectStore(store).put(obj);
  await done(t);
  const arr = state[store];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
}

export async function put(store, obj) {
  const o = { ...obj, updatedAt: Date.now() };
  await putRaw(store, o);
  return o;
}

export async function removeForever(store, id) {
  const t = db.transaction(['subjects', 'lessons'], 'readwrite');
  t.objectStore(store).delete(id);
  if (store === 'subjects') for (const l of state.lessons.filter((x) => x.subjectId === id)) t.objectStore('lessons').delete(l.id);
  await done(t);
  if (store === 'subjects') state.lessons = state.lessons.filter((x) => x.subjectId !== id);
  state[store] = state[store].filter((x) => x.id !== id);
}

export async function clearAll() {
  const t = db.transaction(['subjects', 'lessons'], 'readwrite');
  t.objectStore('subjects').clear();
  t.objectStore('lessons').clear();
  await done(t);
  state.subjects = [];
  state.lessons = [];
}

export async function setMeta(key, value) {
  const t = db.transaction(['meta'], 'readwrite');
  t.objectStore('meta').put({ key, value });
  await done(t);
  state.meta[key] = value;
}

async function purgeTrash() {
  const limit = Date.now() - TRASH_DAYS * 864e5;
  for (const s of [...state.subjects]) if (s.deletedAt && s.deletedAt < limit) await removeForever('subjects', s.id);
  for (const l of [...state.lessons]) if (l.deletedAt && l.deletedAt < limit) await removeForever('lessons', l.id);
}

export const activeSubjects = () =>
  state.subjects.filter((s) => !s.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function activeLessons(subjectId) {
  const ok = new Set(activeSubjects().map((s) => s.id));
  return state.lessons.filter((l) => !l.deletedAt && ok.has(l.subjectId) && (!subjectId || l.subjectId === subjectId));
}

// Éléments dans la corbeille (les leçons d'une matière supprimée reviennent avec elle)
export const trashed = () => ({
  subjects: state.subjects.filter((s) => s.deletedAt),
  lessons: state.lessons.filter((l) => l.deletedAt && state.subjects.some((s) => s.id === l.subjectId && !s.deletedAt)),
});

// Recherche par début de mot, insensible aux accents. Titre (3) > tags et matière (2) > contenu (1).
export function search(q) {
  const toks = words(q);
  if (!toks.length) return { hits: [], suggestions: [] };
  const subj = new Map(activeSubjects().map((s) => [s.id, s]));
  const hits = [];
  for (const l of activeLessons()) {
    const s = subj.get(l.subjectId);
    const fields = [[words(l.title), 3], [words((l.tags || []).join(' ')), 2], [words(s.name), 2], [words(l.content), 1]];
    let score = 0;
    let ok = true;
    for (const t of toks) {
      let best = 0;
      for (const [w, pts] of fields) if (pts > best && w.some((x) => x.startsWith(t))) best = pts;
      if (!best) { ok = false; break; }
      score += best;
    }
    if (ok) hits.push({ lesson: l, subject: s, score });
  }
  hits.sort((a, b) => b.score - a.score || b.lesson.updatedAt - a.lesson.updatedAt);

  const nq = norm(q.trim());
  const suggestions = [];
  activeSubjects().filter((s) => norm(s.name).includes(nq)).slice(0, 3)
    .forEach((s) => suggestions.push({ kind: 'Matière', label: s.name }));
  const tags = [...new Set(activeLessons().flatMap((l) => l.tags || []))];
  tags.filter((t) => norm(t).includes(nq)).slice(0, 3).forEach((t) => suggestions.push({ kind: 'Tag', label: t }));
  hits.filter((h) => norm(h.lesson.title).includes(nq)).slice(0, 3)
    .forEach((h) => suggestions.push({ kind: 'Leçon', label: h.lesson.title }));
  return { hits: hits.slice(0, 30), suggestions: suggestions.slice(0, 7) };
}
