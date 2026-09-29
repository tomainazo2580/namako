import * as DB from './db.js';
import * as BK from './backup.js';

const app = document.querySelector('#app');
const dlg = document.querySelector('#dlg');
const COLORS = ['#0E7C86', '#E4572E', '#E9A23B', '#5E8C31', '#7B5EA7', '#C2456B', '#2F6DB5', '#8A5A3C'];

let view = { name: 'home' };
let query = '';
let picked = '';
let installEvt = null;
let pending = null;
let timer;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const days = (ts) => Math.floor((Date.now() - ts) / 864e5);
const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const find = (store, id) => DB.state[store].find((x) => x.id === id);

/* ---------- Écrans ---------- */

function banners() {
  const out = [];
  const last = DB.state.meta.lastBackupAt;
  if (DB.activeLessons().length > 0 && (!last || days(last) >= 7)) {
    const msg = last ? `Dernière sauvegarde il y a ${plural(days(last), 'jour', 'jours')}.` : 'Vos cours ne sont pas encore sauvegardés.';
    out.push(`<div class="banner"><span>${msg}</span><button data-act="backup-now">Sauvegarder</button></div>`);
  }
  if (installEvt) out.push('<div class="banner"><span>Ajoutez Namako à votre écran d’accueil.</span><button data-act="install">Installer</button></div>');
  return out.join('');
}

function renderHome() {
  const n = DB.activeSubjects().length;
  app.innerHTML = `
    <header class="top"><div><h1>Namako</h1><p class="sub">${n ? plural(n, 'matière', 'matières') : 'Vos cours, toujours avec vous'}</p></div>
    <button class="ghost" data-act="menu">Sauvegarde</button></header>
    ${banners()}
    <div class="search"><input id="q" type="search" autocomplete="off" placeholder="Chercher un titre, un tag, une matière" aria-label="Rechercher dans vos leçons" value="${esc(query)}"><div id="sugg" class="sugg"></div></div>
    <div id="list"></div>
    <button class="fab" data-act="new-subject">Nouvelle matière</button>`;
}

const cardHtml = (s) => {
  const ls = DB.activeLessons(s.id);
  const due = ls.filter((l) => l.nextReviewAt && l.nextReviewAt <= Date.now()).length;
  return `<button class="card" data-act="open-subject" data-id="${s.id}"><i style="background:${s.color}"></i>
    <span class="cb"><b>${esc(s.name)}</b><small>${plural(ls.length, 'leçon', 'leçons')}</small></span>
    ${due ? `<em style="box-shadow:inset 0 0 0 2px ${s.color}">${due} à revoir</em>` : ''}</button>`;
};

const lessonHtml = (l, s, showSubject) => `<button class="hit" data-act="open-lesson" data-id="${l.id}"><i style="background:${s.color}"></i>
  <span class="cb"><b>${esc(l.title)}</b>${showSubject ? `<small>${esc(s.name)}</small>` : ''}${(l.tags || []).length ? `<small>${esc(l.tags.join(', '))}</small>` : ''}
  <span class="ex">${esc(l.content.slice(0, 110))}</span></span></button>`;

function refreshList() {
  const list = document.querySelector('#list');
  const sugg = document.querySelector('#sugg');
  if (!list) return;
  const q = query.trim();
  if (q.length < 2) {
    sugg.innerHTML = '';
    const subs = DB.activeSubjects();
    list.innerHTML = subs.length ? subs.map(cardHtml).join('') : '<p class="empty">Aucune matière pour l’instant. Créez-en une pour y ranger vos leçons.</p>';
    return;
  }
  const { hits, suggestions } = DB.search(q);
  sugg.innerHTML = query === picked ? '' : suggestions.map((s) => `<button class="row" data-act="pick" data-label="${esc(s.label)}"><span>${esc(s.label)}</span><small>${s.kind}</small></button>`).join('');
  list.innerHTML = hits.length ? hits.map((h) => lessonHtml(h.lesson, h.subject, true)).join('') : `<p class="empty">Aucun résultat pour « ${esc(q)} ». Essayez un autre mot ou un tag.</p>`;
}

function renderSubject(id) {
  const s = find('subjects', id);
  if (!s || s.deletedAt) return go({ name: 'home' });
  const ls = DB.activeLessons(id).sort((a, b) => b.updatedAt - a.updatedAt);
  app.innerHTML = `
    <header class="top"><button class="ghost" data-act="back">Retour</button><button class="ghost" data-act="edit-subject" data-id="${id}">Modifier</button></header>
    <h1 class="sh" style="--c:${s.color}">${esc(s.name)}</h1><p class="sub">${plural(ls.length, 'leçon', 'leçons')}</p>
    <section style="margin-top:16px">${ls.length ? ls.map((l) => lessonHtml(l, s, false)).join('') : '<p class="empty">Aucune leçon ici. Ajoutez la première.</p>'}</section>
    <button class="fab" data-act="new-lesson" data-id="${id}">Nouvelle leçon</button>`;
}

function render() {
  if (view.name === 'subject') renderSubject(view.id);
  else { renderHome(); refreshList(); }
}
function go(v) { view = v; render(); scrollTo(0, 0); }

/* ---------- Fenêtres ---------- */

const openDlg = (html) => { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); };
const closeDlg = () => { if (dlg.open) dlg.close(); };
const message = (title, text) => openDlg(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions"><button class="primary" data-act="close">Fermer</button></div>`);

function subjectDialog(s) {
  const cur = s?.color || COLORS[0];
  openDlg(`<form data-form="subject" data-id="${s?.id || ''}"><h2>${s ? 'Modifier la matière' : 'Nouvelle matière'}</h2>
    <label>Nom<input name="name" required maxlength="60" value="${esc(s?.name || '')}" autofocus></label>
    <div class="swatches" role="radiogroup" aria-label="Couleur">${COLORS.map((c) => `<label class="sw"><input type="radio" name="color" value="${c}" aria-label="Couleur ${c}" ${c === cur ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>
    <div class="actions">${s ? `<button type="button" class="danger" data-act="trash-subject" data-id="${s.id}">Mettre à la corbeille</button>` : ''}
    <button type="button" class="ghost" data-act="close">Annuler</button><button class="primary">${s ? 'Enregistrer' : 'Créer la matière'}</button></div></form>`);
}

function lessonDialog(l, subjectId) {
  openDlg(`<form data-form="lesson" data-id="${l?.id || ''}" data-subject="${l?.subjectId || subjectId}"><h2>${l ? 'Modifier la leçon' : 'Nouvelle leçon'}</h2>
    <label>Titre<input name="title" required maxlength="120" value="${esc(l?.title || '')}" autofocus></label>
    <label>Contenu<textarea name="content" rows="10">${esc(l?.content || '')}</textarea></label>
    <label>Tags, séparés par des virgules<input name="tags" value="${esc((l?.tags || []).join(', '))}"></label>
    <div class="actions">${l ? `<button type="button" class="danger" data-act="trash-lesson" data-id="${l.id}">Mettre à la corbeille</button>` : ''}
    <button type="button" class="ghost" data-act="close">Annuler</button><button class="primary">Enregistrer</button></div></form>`);
}

async function backupDialog() {
  const persisted = await navigator.storage?.persisted?.();
  const est = await navigator.storage?.estimate?.();
  const last = DB.state.meta.lastBackupAt;
  const t = DB.trashed();
  openDlg(`<h2>Sauvegarde</h2>
    <p>${last ? `Dernière sauvegarde : ${fmtDate(last)}.` : 'Aucune sauvegarde pour l’instant.'}</p>
    <div class="actions col"><button class="primary" data-act="backup-now">Sauvegarder mes cours</button>
    <button data-act="restore">Restaurer depuis un fichier</button>
    <button data-act="trash">Corbeille (${t.subjects.length + t.lessons.length})</button></div>
    <p class="note">Stockage protégé : <b>${persisted ? 'oui' : 'non'}</b>.${est?.usage != null ? ` Espace utilisé : ${(est.usage / 1048576).toFixed(1)} Mo.` : ''}</p>
    ${persisted ? '' : '<button class="ghost" data-act="persist">Protéger mes données</button>'}
    <p class="note">Ne choisissez jamais « Effacer les données » pour Namako ou pour votre navigateur dans les réglages du téléphone : vos cours seraient perdus. Effacer seulement le cache est sans danger.</p>
    <div class="actions"><button class="ghost" data-act="close">Fermer</button></div>`);
}

function trashDialog() {
  const t = DB.trashed();
  const row = (store, x, label) => `<div class="item"><span>${esc(label)}<br><small class="note">supprimé le ${fmtDate(x.deletedAt)}</small></span>
    <span><button class="ghost" data-act="restore-item" data-store="${store}" data-id="${x.id}">Restaurer</button>
    <button class="danger" data-act="delete-item" data-store="${store}" data-id="${x.id}">Supprimer</button></span></div>`;
  const rows = t.subjects.map((s) => row('subjects', s, `Matière : ${s.name}`)).concat(t.lessons.map((l) => row('lessons', l, `Leçon : ${l.title}`)));
  openDlg(`<h2>Corbeille</h2><p class="note">Les éléments sont supprimés définitivement après 30 jours.</p>
    ${rows.length ? rows.join('') : '<p class="empty">La corbeille est vide.</p>'}
    <div class="actions"><button class="ghost" data-act="menu">Retour</button></div>`);
}

function importDialog(b) {
  openDlg(`<h2>Restaurer une sauvegarde</h2>
    <p>Sauvegarde du ${fmtDate(b.exportedAt)} : ${plural(b.data.subjects.length, 'matière', 'matières')} et ${plural(b.data.lessons.length, 'leçon', 'leçons')}.</p>
    <p class="note">Fusionner garde vos cours actuels et ajoute ceux de la sauvegarde, sans doublons. Remplacer efface d’abord vos cours actuels.</p>
    <div class="actions col"><button class="primary" data-act="apply" data-mode="merge">Fusionner avec mes cours</button>
    <button class="danger" data-act="apply" data-mode="replace">Remplacer mes cours</button>
    <button class="ghost" data-act="close">Annuler</button></div>`);
}

/* ---------- Actions ---------- */

async function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id, label, store, mode } = el.dataset;
  switch (act) {
    case 'open-subject': return go({ name: 'subject', id });
    case 'back': query = ''; picked = ''; return go({ name: 'home' });
    case 'new-subject': return subjectDialog();
    case 'edit-subject': return subjectDialog(find('subjects', id));
    case 'trash-subject': await DB.put('subjects', { ...find('subjects', id), deletedAt: Date.now() }); closeDlg(); return go({ name: 'home' });
    case 'new-lesson': return lessonDialog(null, id);
    case 'open-lesson': return lessonDialog(find('lessons', id));
    case 'trash-lesson': await DB.put('lessons', { ...find('lessons', id), deletedAt: Date.now() }); closeDlg(); return render();
    case 'pick': picked = label; query = label; document.querySelector('#q').value = label; return refreshList();
    case 'menu': return backupDialog();
    case 'close': return closeDlg();
    case 'backup-now': if (await BK.exportBackup()) { closeDlg(); render(); } return;
    case 'restore': return document.querySelector('#file').click();
    case 'persist': await navigator.storage.persist(); return backupDialog();
    case 'trash': return trashDialog();
    case 'restore-item': await DB.put(store, { ...find(store, id), deletedAt: null }); trashDialog(); return render();
    case 'delete-item': if (confirm('Supprimer définitivement ? Cette action est irréversible.')) { await DB.removeForever(store, id); trashDialog(); render(); } return;
    case 'install': installEvt.prompt(); await installEvt.userChoice; installEvt = null; return render();
    case 'apply': {
      if (mode === 'replace' && !confirm('Vos cours actuels seront effacés et remplacés. Continuer ?')) return;
      const r = await BK.applyBackup(pending, mode);
      pending = null;
      render();
      return message('Restauration terminée', `${plural(r.added, 'élément ajouté', 'éléments ajoutés')}, ${plural(r.updated, 'élément mis à jour', 'éléments mis à jour')}.`);
    }
  }
}

dlg.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const d = new FormData(f);
  const id = f.dataset.id;
  if (f.dataset.form === 'subject') {
    const name = String(d.get('name')).trim();
    if (!name) return;
    const base = id ? find('subjects', id) : { id: DB.uid(), createdAt: Date.now(), deletedAt: null };
    await DB.put('subjects', { ...base, name, color: d.get('color') });
    if (!id) navigator.storage?.persist?.();
  } else {
    const title = String(d.get('title')).trim();
    if (!title) return;
    const tags = [...new Map(String(d.get('tags')).split(',').map((t) => t.trim()).filter(Boolean).map((t) => [t.toLowerCase(), t])).values()];
    const base = id ? find('lessons', id) : { id: DB.uid(), subjectId: f.dataset.subject, createdAt: Date.now(), deletedAt: null, mastery: 0, nextReviewAt: null };
    await DB.put('lessons', { ...base, title, content: String(d.get('content')), tags });
  }
  closeDlg();
  render();
});

app.addEventListener('click', onClick);
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDlg(); else onClick(e); });
app.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  query = e.target.value;
  picked = '';
  clearTimeout(timer);
  timer = setTimeout(refreshList, 150);
});

document.querySelector('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { pending = await BK.readBackup(f); importDialog(pending); }
  catch (err) { message('Restauration impossible', err.message); }
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (view.name === 'home') { renderHome(); refreshList(); } });
window.addEventListener('appinstalled', () => { installEvt = null; render(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

(async () => {
  try { await DB.init(); }
  catch { app.innerHTML = '<p class="empty">Le stockage du navigateur est indisponible (navigation privée ?). Ouvrez Namako dans une fenêtre normale.</p>'; return; }
  render();
})();
