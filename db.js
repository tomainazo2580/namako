// Base locale (IndexedDB) et recherche. Aucune donnée ne quitte le téléphone.
const DB_NAME = 'namako';
const DB_VERSION = 3;
const TRASH_DAYS = 30;
let db;

export const state = { subjects: [], lessons: [], reviews: [], attachments: [], meta: {} };

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
      if (!d.objectStoreNames.contains('reviews')) d.createObjectStore('reviews', { keyPath: 'id' }).createIndex('day', 'day');
      if (!d.objectStoreNames.contains('attachments')) d.createObjectStore('attachments', { keyPath: 'id' }).createIndex('lessonId', 'lessonId');
    };
    // Une autre fenêtre de Namako ouverte avec l'ancienne version peut bloquer la mise à jour de la base
    r.onblocked = () => { const m = typeof document !== 'undefined' && document.querySelector('#app'); if (m) m.innerHTML = '<p class="empty">Fermez les autres fenêtres de Namako, puis rouvrez l’application.</p>'; };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

const metaOf = (a) => ({ id: a.id, lessonId: a.lessonId, name: a.name, size: a.size || 0, createdAt: a.createdAt });

export async function init() {
  db = await open();
  db.onversionchange = () => db.close();   // laisse passer les futures mises à jour de structure
  const t = db.transaction(['subjects', 'lessons', 'reviews', 'attachments', 'meta']);
  const [s, l, r, a, m] = await Promise.all([
    wrap(t.objectStore('subjects').getAll()),
    wrap(t.objectStore('lessons').getAll()),
    wrap(t.objectStore('reviews').getAll()),
    wrap(t.objectStore('attachments').getAll()),
    wrap(t.objectStore('meta').getAll()),
  ]);
  state.subjects = s;
  state.lessons = l;
  state.reviews = r;
  state.attachments = a.map(metaOf);          // on ne garde en mémoire que les informations, pas les images
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
  const lessonIds = store === 'subjects' ? state.lessons.filter((x) => x.subjectId === id).map((l) => l.id) : store === 'lessons' ? [id] : [];
  const attIds = state.attachments.filter((a) => lessonIds.includes(a.lessonId)).map((a) => a.id);
  const t = db.transaction(['subjects', 'lessons', 'attachments'], 'readwrite');
  t.objectStore(store).delete(id);
  if (store === 'subjects') for (const lid of lessonIds) t.objectStore('lessons').delete(lid);
  for (const aid of attIds) t.objectStore('attachments').delete(aid);
  await done(t);
  if (store === 'subjects') state.lessons = state.lessons.filter((x) => x.subjectId !== id);
  state.attachments = state.attachments.filter((a) => !attIds.includes(a.id));
  state[store] = state[store].filter((x) => x.id !== id);
}

// Les photos ne sont effacées que si la sauvegarde restaurée en contient (sinon elles restent attachées à leurs leçons)
export async function clearAll(withAttachments = false) {
  const stores = ['subjects', 'lessons', 'reviews'].concat(withAttachments ? ['attachments'] : []);
  const t = db.transaction(stores, 'readwrite');
  stores.forEach((s) => t.objectStore(s).clear());
  await done(t);
  state.subjects = [];
  state.lessons = [];
  state.reviews = [];
  if (withAttachments) state.attachments = [];
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
  // photos dont la leçon n'existe plus
  const live = new Set(state.lessons.map((l) => l.id));
  for (const a of [...state.attachments]) if (!live.has(a.lessonId)) await removeAttachment(a.id);
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

/* ---- Photos attachées aux leçons (les images sont stockées dans IndexedDB, hors de la mémoire) ---- */
export async function putAttachmentRaw(rec) {
  const t = db.transaction(['attachments'], 'readwrite');
  t.objectStore('attachments').put(rec);
  await done(t);
  const meta = metaOf(rec);
  const i = state.attachments.findIndex((a) => a.id === rec.id);
  if (i >= 0) state.attachments[i] = meta; else state.attachments.push(meta);
}

export async function addAttachment(lessonId, blob, name = 'photo.jpg') {
  const rec = { id: uid(), lessonId, name, type: blob.type || 'image/jpeg', size: blob.size, createdAt: Date.now(), blob };
  await putAttachmentRaw(rec);
  return rec.id;
}

export const getAttachment = (id) => wrap(db.transaction(['attachments']).objectStore('attachments').get(id));

export async function removeAttachment(id) {
  const t = db.transaction(['attachments'], 'readwrite');
  t.objectStore('attachments').delete(id);
  await done(t);
  state.attachments = state.attachments.filter((a) => a.id !== id);
}

export const attachmentsOf = (lessonId) => state.attachments.filter((a) => a.lessonId === lessonId).sort((a, b) => a.createdAt - b.createdAt);
export const attachmentsTotal = () => state.attachments.reduce((n, a) => n + (a.size || 0), 0);
