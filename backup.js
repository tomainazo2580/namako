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
  const data = { subjects, lessons };
  return { app: 'namako', formatVersion: FORMAT_VERSION, exportedAt: Date.now(), data, checksum: await sha256(JSON.stringify(data)) };
}

// Renvoie null si l'étudiant annule, 'shared' si le partage a eu lieu, 'downloaded' si le fichier a été téléchargé.
export async function exportBackup() {
  const json = JSON.stringify(await buildBackup());
  const stamp = new Date().toISOString().slice(0, 10);
  // Partage en .txt : les navigateurs acceptent ce type pour WhatsApp et les autres applications.
  const shareFile = new File([json], `namako-${stamp}.txt`, { type: 'text/plain' });
  let shared = false;
  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile], title: 'Sauvegarde Namako', text: 'Sauvegarde de mes cours Namako' }); shared = true; }
    catch (e) { if (e.name === 'AbortError') return null; }
  }
  if (!shared) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = `namako-${stamp}.namako`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  await setMeta('lastBackupAt', Date.now());
  return shared ? 'shared' : 'downloaded';
}

export async function readBackup(file) {
  let b;
  try { b = JSON.parse(await file.text()); } catch { throw new Error('Ce fichier n’est pas une sauvegarde Namako.'); }
  if (b.app !== 'namako' || !b.data || !Array.isArray(b.data.subjects) || !Array.isArray(b.data.lessons))
    throw new Error('Ce fichier n’est pas une sauvegarde Namako.');
  if (b.formatVersion > FORMAT_VERSION) throw new Error('Cette sauvegarde vient d’une version plus récente de Namako. Mettez l’app à jour.');
  if ((await sha256(JSON.stringify(b.data))) !== b.checksum) throw new Error('Le fichier est abîmé ou a été modifié. Demandez-en une nouvelle copie.');
  return b;
}

// mode : 'merge' (garde le plus récent, sans doublons) ou 'replace' (efface d'abord)
export async function applyBackup(b, mode) {
  if (mode === 'replace') await clearAll();
  let added = 0, updated = 0;
  for (const store of ['subjects', 'lessons']) {
    for (const item of b.data[store]) {
      const cur = state[store].find((x) => x.id === item.id);
      if (!cur) { await putRaw(store, item); added++; }
      else if (item.updatedAt > cur.updatedAt) { await putRaw(store, item); updated++; }
    }
  }
  return { added, updated };
}
