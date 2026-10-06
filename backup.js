// Sauvegarde et restauration : fichier .namako (JSON versionné + somme de contrôle).
import { state, putRaw, clearAll, setMeta } from './db.js';

const FORMAT_VERSION = 1;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildBackup() {
  const subjects = state.subjects.filter((s) => !s.deletedAt);
  const ok = new Set(subjects.map((s) => s.id));
  const lessons = state.lessons.filter((l) => !l.deletedAt && ok.has(l.subjectId));
  const data = { subjects, lessons, reviews: state.reviews };
  return { app: 'namako', formatVersion: FORMAT_VERSION, exportedAt: Date.now(), data, checksum: await sha256(JSON.stringify(data)) };
}

export const io = { put: putRaw };

// Partage via WhatsApp et autres applications (fichier .txt) ou, à défaut, téléchargement (.namako).
// Renvoie null si l'étudiant annule, 'shared' ou 'downloaded'.
async function deliver(json, base, title, text) {
  const shareFile = new File([json], `${base}.txt`, { type: 'text/plain' });
  let shared = false;
  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile], title, text }); shared = true; }
    catch (e) { if (e.name === 'AbortError') return null; }
  }
  if (!shared) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${base}.namako`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return shared ? 'shared' : 'downloaded';
}

export async function exportBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  const r = await deliver(JSON.stringify(await buildBackup()), `namako-${stamp}`, 'Sauvegarde Namako', 'Sauvegarde de mes cours Namako');
  if (r) await setMeta('lastBackupAt', Date.now());
  return r;
}

/* ---- Partage de cours entre étudiants (matières entières ou leçons choisies) ---- */
export const isShare = (b) => b.kind === 'share' || b.kind === 'subject';   // 'subject' = ancien format, toujours accepté

const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'cours';

// La progression de révision n'est jamais partagée : chaque étudiant révise à son rythme
export async function buildShare(subjects, lessons) {
  const data = {
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, color: s.color, createdAt: s.createdAt, updatedAt: s.updatedAt, deletedAt: null })),
    lessons: lessons.map((l) => ({ id: l.id, subjectId: l.subjectId, title: l.title, content: l.content, tags: l.tags || [], source: l.source || 'manual', createdAt: l.createdAt, updatedAt: l.updatedAt, deletedAt: null })),
  };
  return { app: 'namako', formatVersion: FORMAT_VERSION, kind: 'share', exportedAt: Date.now(), data, checksum: await sha256(JSON.stringify(data)) };
}

export async function exportShare(subjects, lessons) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = subjects.length === 1 ? subjects[0].name : `${subjects.length} matières`;
  return deliver(JSON.stringify(await buildShare(subjects, lessons)), `namako-${subjects.length === 1 ? slug(subjects[0].name) : 'cours'}-${stamp}`,
    `Cours Namako : ${name}`, `Cours « ${name} » à ouvrir dans Namako`);
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const str = (v, max) => String(v ?? '').slice(0, max);
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

// Un fichier reçu n'est jamais fiable : chaque champ est revérifié et nettoyé avant d'être enregistré.
// Les leçons déjà présentes gardent leur progression de révision.
export async function applyShare(b) {
  if (!isShare(b)) throw new Error('Ce fichier ne contient pas de cours partagés.');
  const now = Date.now();
  const names = new Map();
  for (const raw of b.data.subjects.slice(0, 50)) {
    const id = str(raw && raw.id, 80);
    if (!id) continue;
    const local = state.subjects.find((x) => x.id === id);
    names.set(id, local ? local.name : (str(raw.name, 60).trim() || 'Matière reçue'));
    if (!local) {
      await io.put('subjects', { id, name: names.get(id), color: COLOR.test(raw.color) ? raw.color : '#0E7C86', createdAt: num(raw.createdAt, now), updatedAt: now, deletedAt: null });
    } else if (local.deletedAt) {
      await io.put('subjects', { ...local, deletedAt: null });
    }
  }
  if (!names.size) throw new Error('Ce fichier ne contient aucune matière valide.');
  let added = 0, updated = 0;
  for (const r of b.data.lessons.slice(0, 2000)) {
    const lid = str(r && r.id, 80);
    const sid = str(r && r.subjectId, 80);
    if (!lid || !names.has(sid)) continue;
    const fields = {
      title: str(r.title, 120).trim() || 'Sans titre',
      content: str(r.content, 500000),
      tags: Array.isArray(r.tags) ? [...new Set(r.tags.slice(0, 20).map((t) => str(t, 40).trim()).filter(Boolean))] : [],
      source: str(r.source, 10) || 'manual',
    };
    const cur = state.lessons.find((x) => x.id === lid);
    if (!cur) {
      await io.put('lessons', { id: lid, subjectId: sid, ...fields, createdAt: num(r.createdAt, now), updatedAt: num(r.updatedAt, now), deletedAt: null, mastery: 0, nextReviewAt: null });
      added++;
    } else if (cur.subjectId === sid && !cur.deletedAt && num(r.updatedAt, 0) > cur.updatedAt) {
      await io.put('lessons', { ...cur, ...fields, updatedAt: num(r.updatedAt, now) });
      updated++;
    }
  }
  return { subjects: names.size, names: [...names.values()], added, updated };
}

export async function readBackup(file) {
  if (file.size > 8e6) throw new Error('Ce fichier est trop volumineux pour être une sauvegarde Namako.');
  let b;
  try { b = JSON.parse(await file.text()); } catch { throw new Error('Ce fichier n’est pas une sauvegarde Namako.'); }
  if (b.app !== 'namako' || !b.data || !Array.isArray(b.data.subjects) || !Array.isArray(b.data.lessons))
    throw new Error('Ce fichier n’est pas une sauvegarde Namako.');
  if (b.formatVersion > FORMAT_VERSION) throw new Error('Cette sauvegarde vient d’une version plus récente de Namako. Mettez l’app à jour.');
  if ((await sha256(JSON.stringify(b.data))) !== b.checksum) throw new Error('Le fichier est abîmé ou a été modifié. Demandez-en une nouvelle copie.');
  if (isShare(b) && (b.data.subjects.length < 1 || b.data.subjects.length > 50)) throw new Error('Ce fichier de cours partagés est invalide.');
  return b;
}

// mode : 'merge' (garde le plus récent, sans doublons) ou 'replace' (efface d'abord)
export async function applyBackup(b, mode) {
  if (mode === 'replace') await clearAll();
  let added = 0, updated = 0;
  for (const store of ['subjects', 'lessons', 'reviews']) {
    for (const item of b.data[store] || []) {
      const cur = state[store].find((x) => x.id === item.id);
      if (!cur) { await io.put(store, item); added++; }
      else if (item.updatedAt > cur.updatedAt) { await io.put(store, item); updated++; }
    }
  }
  return { added, updated };
}

/* ---- Partage par lien : les cours voyagent dans l'adresse, un simple appui les ouvre dans Namako ---- */
export const canLink = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
const MAX_UNZIPPED = 8e6;

const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function squeeze(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
}
async function unsqueeze(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_UNZIPPED) { await reader.cancel(); throw new Error('trop volumineux'); }   // protège contre un lien piégé
    parts.push(value);
  }
  return new Blob(parts).arrayBuffer().then((buf) => new Uint8Array(buf));
}

export async function shareToText(share) {
  return b64u(await squeeze(new TextEncoder().encode(JSON.stringify({ k: 's', d: share.data }))));
}

export async function shareFromText(text) {
  let o;
  try { o = JSON.parse(new TextDecoder().decode(await unsqueeze(unb64u(text)))); }
  catch { throw new Error('Ce lien est incomplet ou abîmé. Demandez-en un nouveau.'); }
  if (!o || o.k !== 's' || !o.d || !Array.isArray(o.d.subjects) || !Array.isArray(o.d.lessons) || o.d.subjects.length < 1 || o.d.subjects.length > 50)
    throw new Error('Ce lien ne contient pas de cours Namako.');
  return { app: 'namako', formatVersion: FORMAT_VERSION, kind: 'share', exportedAt: Date.now(), data: o.d };
}

/* ---- Sauvegardes automatiques : 3 copies récentes gardées sur le téléphone (protègent contre les erreurs) ---- */
const SNAP_SLOTS = [1, 2, 3];
const fingerprint = () => {
  const items = [...state.subjects, ...state.lessons];
  return `${items.length}:${items.reduce((m, x) => Math.max(m, x.updatedAt || 0), 0)}:${state.reviews.length}`;
};

export async function autoSnapshot() {
  const hasData = state.reviews.length > 0 || state.lessons.some((l) => !l.deletedAt && l.source !== 'pack');
  if (!hasData) return false;
  const fp = fingerprint();
  if (state.meta.snapFp === fp || Date.now() - (state.meta.snapAt || 0) < 20 * 36e5) return false;
  const backup = await buildBackup();
  const json = JSON.stringify(backup);
  if (json.length > 8e6) return false;
  for (let i = SNAP_SLOTS.length; i >= 2; i--) {
    const prev = state.meta['snap' + (i - 1)];
    if (prev) await setMeta('snap' + i, prev);
  }
  await setMeta('snap1', { at: Date.now(), json, subjects: backup.data.subjects.length, lessons: backup.data.lessons.length });
  await setMeta('snapAt', Date.now());
  await setMeta('snapFp', fp);
  return true;
}

export const getSnapshots = () =>
  SNAP_SLOTS.map((slot) => ({ slot, v: state.meta['snap' + slot] })).filter((x) => x.v).map(({ slot, v }) => ({ slot, at: v.at, subjects: v.subjects, lessons: v.lessons }));
export const readSnapshot = (slot) => JSON.parse(state.meta['snap' + slot].json);
