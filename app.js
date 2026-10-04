import * as DB from './db.js';
import * as BK from './backup.js';
import * as RV from './review.js';
import * as LIC from './license.js';
import * as CFG from './config.js';
import * as SC from './scan.js';
import * as Spell from './spell.js';
import { qrSvg } from './qr.js';

const app = document.querySelector('#app');
const dlg = document.querySelector('#dlg');
const COLORS = ['#0E7C86', '#E4572E', '#E9A23B', '#5E8C31', '#7B5EA7', '#C2456B', '#2F6DB5', '#8A5A3C'];

let view = { name: 'home' };
let query = '';
let picked = '';
let installEvt = null;
let pending = null;
let timer;
let session = null;
let blocked = false;
const sessionIgnore = new Set();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const days = (ts) => Math.floor((Date.now() - ts) / 864e5);
const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const find = (store, id) => DB.state[store].find((x) => x.id === id);

/* ---------- Écrans ---------- */

function banners() {
  const out = [];
  if (LIC.lic.enforced && !LIC.lic.licensed) out.push(`<div class="banner"><span>Essai gratuit : ${plural(LIC.lic.daysLeft, 'jour restant', 'jours restants')}.</span><button data-act="activate">Activer</button></div>`);
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
    <span><button class="ghost" data-act="stats">Progression</button><button class="ghost" data-act="menu">Sauvegarde</button></span></header>
    ${banners()}${reviewCard()}
    <div class="search"><input id="q" type="search" autocomplete="off" placeholder="Chercher un titre, un tag, une matière" aria-label="Rechercher dans vos leçons" value="${esc(query)}"><div id="sugg" class="sugg"></div></div>
    <div id="list"></div>
    <button class="fab" data-act="new-subject">Nouvelle matière</button>`;
}

const cardHtml = (s) => {
  const ls = DB.activeLessons(s.id);
  const due = ls.filter((l) => RV.isDue(l)).length;
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
    <header class="top"><button class="ghost" data-act="back">Retour</button><button class="ghost" data-act="import-menu">Importer</button><button class="ghost" data-act="edit-subject" data-id="${id}">Modifier</button></header>
    <h1 class="sh" style="--c:${s.color}">${esc(s.name)}</h1><p class="sub">${plural(ls.length, 'leçon', 'leçons')}</p>
    <button class="ghost" style="padding:0;margin-top:4px" data-act="share-subject" data-id="${id}">Partager cette matière</button>
    ${RV.dueLessons(id).length ? `<button class="primary" style="margin-top:12px" data-act="review" data-id="${id}">Réviser cette matière (${RV.dueLessons(id).length})</button>` : ''}
    <section style="margin-top:16px">${ls.length ? ls.map((l) => lessonHtml(l, s, false)).join('') : '<p class="empty">Aucune leçon ici. Ajoutez la première.</p>'}</section>
    <button class="fab" data-act="new-lesson" data-id="${id}">Nouvelle leçon</button>`;
}

function render() {
  if (blocked) renderUpdate();
  else if (LIC.lic.locked || view.name === 'activate') renderActivate();
  else if (view.name === 'subject') renderSubject(view.id);
  else if (view.name === 'lesson') renderLesson(view.id);
  else if (view.name === 'review') renderReview();
  else if (view.name === 'stats') renderStats();
  else { renderHome(); refreshList(); }
}
function go(v) { stopSpeak(); view = v; render(); scrollTo(0, 0); }

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

function lessonDialog(l, subjectId, draft) {
  openDlg(`<form data-form="lesson" data-id="${l?.id || ''}" data-subject="${l?.subjectId || subjectId}" data-source="${esc(draft?.source || '')}"><h2>${l ? 'Modifier la leçon' : 'Nouvelle leçon'}</h2>
    ${draft ? '<p class="note">Relisez le texte reconnu et corrigez-le si besoin avant d’enregistrer.</p>' : ''}
    <label>Titre<input name="title" lang="fr" spellcheck="true" required maxlength="120" value="${esc(l?.title || draft?.title || '')}" autofocus></label>
    ${toolbar()}<label>Contenu<textarea name="content" lang="fr" spellcheck="true" autocorrect="on" rows="12">${esc(l?.content || draft?.content || '')}</textarea></label>
    <p class="note">Pour écrire à la voix, touchez le micro de votre clavier. Le bouton Orthographe vérifie les fautes.</p>
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
    <button data-act="restore">Restaurer ou recevoir un fichier</button>
    <button data-act="share-app">Partager l’application (QR Code)</button>
    ${LIC.lic.enforced ? `<button data-act="activate">${LIC.lic.licensed ? 'Mon activation' : 'Activer Namako'}</button>` : ''}
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

function subjectReceivedDialog(b) {
  const s = b.data.subjects[0];
  const exists = DB.state.subjects.some((x) => x.id === s.id && !x.deletedAt);
  openDlg(`<h2>Matière reçue</h2>
    <p><b>${esc(String(s.name).slice(0, 60))}</b> : ${plural(b.data.lessons.length, 'leçon', 'leçons')}.</p>
    <p class="note">${exists ? 'Vous avez déjà cette matière : les nouvelles leçons seront ajoutées et les leçons modifiées mises à jour. Votre progression de révision est conservée.' : 'Elle sera ajoutée à vos matières, à côté de vos cours actuels. Rien n’est effacé.'}</p>
    <div class="actions col"><button class="primary" data-act="apply" data-mode="subject">Ajouter cette matière</button><button class="ghost" data-act="close">Annuler</button></div>`);
}

function importDialog(b) {
  if (b.kind === 'subject') return subjectReceivedDialog(b);
  openDlg(`<h2>Restaurer une sauvegarde</h2>
    <p>Sauvegarde du ${fmtDate(b.exportedAt)} : ${plural(b.data.subjects.length, 'matière', 'matières')} et ${plural(b.data.lessons.length, 'leçon', 'leçons')}.</p>
    <p class="note">Fusionner garde vos cours actuels et ajoute ceux de la sauvegarde, sans doublons. Remplacer efface d’abord vos cours actuels.</p>
    <div class="actions col"><button class="primary" data-act="apply" data-mode="merge">Fusionner avec mes cours</button>
    <button class="danger" data-act="apply" data-mode="replace">Remplacer mes cours</button>
    <button class="ghost" data-act="close">Annuler</button></div>`);
}

/* ---------- Partage : matière et application ---------- */

async function shareSubject(id) {
  const s = find('subjects', id);
  const lessons = DB.activeLessons(id);
  if (!s || !lessons.length) return message('Rien à partager', 'Cette matière ne contient aucune leçon pour l’instant.');
  const r = await BK.exportSubject(s, lessons);
  if (!r) return;
  message(r === 'shared' ? 'Matière prête' : 'Fichier enregistré',
    r === 'shared'
      ? 'Votre camarade doit ouvrir Namako, puis Sauvegarde, puis « Restaurer ou recevoir un fichier », et choisir le fichier reçu. Votre progression de révision n’est pas partagée.'
      : 'Le partage n’est pas disponible ici. Le fichier est dans vos Téléchargements : envoyez-le par WhatsApp. Votre camarade l’ouvre dans Namako, menu Sauvegarde, « Restaurer ou recevoir un fichier ».');
}

const appLink = () => new URL('./', location.href).href;

function qrDialog() {
  const url = appLink();
  let svg = '';
  try { svg = qrSvg(url); } catch { /* lien trop long : on garde seulement le texte */ }
  openDlg(`<h2>Partager Namako</h2>
    <p>Votre camarade scanne ce QR Code avec l’appareil photo de son téléphone : Namako s’ouvre et il peut l’installer sur son écran d’accueil.</p>
    ${svg ? `<div class="qr" role="img" aria-label="QR Code du lien de Namako">${svg}</div>` : ''}
    <p class="note" style="word-break:break-all">${esc(url)}</p>
    <div class="actions col"><button data-act="copy" data-text="${esc(url)}">Copier le lien</button>
    ${navigator.share ? '<button class="primary" data-act="share-link">Envoyer le lien</button>' : ''}
    <button class="ghost" data-act="close">Fermer</button></div>`);
}

async function shareLink() {
  try { await navigator.share({ title: 'Namako', text: 'Révise tes cours avec Namako, même sans connexion :', url: appLink() }); }
  catch { /* annulé */ }
}

/* ---------- Correcteur d'orthographe ---------- */

async function runSpell() {
  const out = dlg.querySelector('#spellout');
  if (!out) return;
  if (!Spell.loaded()) {
    if (!DB.state.meta.spellReady) {
      if (!navigator.onLine) { out.innerHTML = '<p class="note">La première utilisation du correcteur demande Internet (environ 2 Mo, une seule fois).</p>'; return; }
      if (!confirm('Le correcteur télécharge un dictionnaire français d’environ 2 Mo, une seule fois. Continuer ?')) return;
    }
    out.innerHTML = '<p class="note">Chargement du dictionnaire…</p>';
    try {
      await Spell.load();
      if (!DB.state.meta.spellReady) await DB.setMeta('spellReady', true);
    } catch (err) { out.innerHTML = `<p class="note">${esc(err.message)}</p>`; return; }
  }
  showSpell();
}

function showSpell() {
  const ta = dlg.querySelector('textarea[name=content]');
  const out = dlg.querySelector('#spellout');
  if (!ta || !out || !Spell.loaded()) return;
  const ignore = new Set([...(DB.state.meta.userWords || []), ...sessionIgnore]);
  const errors = Spell.findErrors(ta.value, ignore);
  if (!errors.length) { out.innerHTML = '<p class="note">Aucune faute détectée. Les noms propres et les sigles ne sont pas vérifiés, ni la grammaire.</p>'; return; }
  const rows = errors.slice(0, 15).map((e) => {
    const sugg = Spell.suggest(e.word).map((s) => `<button type="button" data-act="spell-fix" data-from="${esc(e.low)}" data-to="${esc(s)}">${esc(s)}</button>`).join('');
    return `<div class="item"><span><b>${esc(e.word)}</b>${e.count > 1 ? ` <small class="note">(${e.count} fois)</small>` : ''}</span>
      <span class="chips">${sugg || '<small class="note">Pas de suggestion</small>'}
      <button type="button" class="ghost" data-act="spell-ignore" data-w="${esc(e.low)}">Ignorer</button>
      <button type="button" class="ghost" data-act="spell-add" data-w="${esc(e.low)}">Ajouter</button></span></div>`;
  }).join('');
  out.innerHTML = `<div class="spell"><p class="note">${plural(errors.length, 'mot à vérifier', 'mots à vérifier')}${errors.length > 15 ? ' (les 15 premiers sont affichés)' : ''}. Touchez une suggestion pour corriger. « Ignorer » convient aux noms propres et aux mots techniques, « Ajouter » les retient pour toujours.</p>${rows}</div>`;
}

/* ---------- Importer : PDF et scan de cours ---------- */

function importMenu() {
  openDlg(`<h2>Importer dans cette matière</h2>
    <div class="actions col">
      <button class="primary" data-act="import-cam">Photographier un cours (scan)</button>
      <button data-act="import-gal">Choisir des photos dans la galerie</button>
      <button data-act="import-pdf">Document PDF</button>
      <button data-act="import-txt">Fichier texte (.txt, .md)</button>
      <button class="ghost" data-act="close">Annuler</button></div>
    <p class="note">Pour un bon scan : page bien à plat, pleine lumière, texte droit et net. Vous pourrez corriger le texte reconnu avant d’enregistrer.</p>`);
}

function openProgress() {
  openDlg(`<h2>Import en cours</h2><p id="plabel">Préparation…</p>
    <div class="prog"><i id="pbar" style="width:3%"></i></div>
    <div class="actions"><button data-act="cancel-scan">Annuler</button></div>`);
}

function progress(label, pct) {
  const l = document.querySelector('#plabel');
  const b = document.querySelector('#pbar');
  if (l) l.textContent = label;
  if (b) b.style.width = Math.max(3, Math.round(pct * 100)) + '%';
}

async function runImport(kind, files) {
  if (view.name !== 'subject') return;
  const subjectId = view.id;
  const ready = DB.state.meta.ocrReady;
  if (kind !== 'pdf' && !ready) {
    if (!navigator.onLine) return message('Connexion nécessaire', 'La première utilisation du scan demande Internet (environ 7 Mo, une seule fois). Ensuite, il fonctionne hors ligne.');
    if (!confirm('La première utilisation du scan télécharge environ 7 Mo, une seule fois. Continuer ?')) return;
  }
  openProgress();
  let usedOcr = kind !== 'pdf';
  try {
    let text, title, source = usedOcr ? 'ocr' : 'pdf';
    if (kind === 'pdf') {
      title = files[0].name.replace(/\.[^.]+$/, '').slice(0, 120);
      text = await SC.importPdf(files[0], progress);
      if (!text.trim()) {
        if (!ready && !navigator.onLine) throw new Error('Ce PDF est un scan : sa lecture demande le module de scan, à télécharger d’abord avec Internet.');
        if (!confirm('Ce PDF ne contient pas de texte (c’est probablement un scan). Lire ses pages avec le module de scan ? Cela peut prendre plusieurs minutes.')) return closeDlg();
        usedOcr = true;
        source = 'ocr';
        text = await SC.ocrPdf(files[0], progress);
      }
    } else {
      title = 'Scan du ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      text = await SC.ocrImages(files, progress);
    }
    if (usedOcr && !ready) await DB.setMeta('ocrReady', true);
    closeDlg();
    if (!text.trim()) return message('Aucun texte trouvé', 'Aucun texte n’a pu être lu. Pour un scan, essayez avec plus de lumière et une photo bien nette.');
    lessonDialog(null, subjectId, { title, content: text, source });
  } catch (err) {
    if (err.message === 'annulé') return closeDlg();
    message('Import impossible', err.message);
  }
}

/* ---------- Activation et mise à jour forcée ---------- */

function renderActivate() {
  const L = LIC.lic;
  const msg = `Bonjour, je souhaite activer Namako. Mon identifiant : ${L.installId}`;
  const intro = L.locked
    ? 'Vos cours sont toujours sur votre téléphone. Activez Namako pour y accéder de nouveau.'
    : L.licensed ? 'Namako est activé à vie sur ce téléphone. Merci !' : `Il vous reste ${plural(L.daysLeft, 'jour', 'jours')} d’essai gratuit.`;
  app.innerHTML = `
    <header class="top">${L.locked ? '<span></span>' : '<button class="ghost" data-act="back">Retour</button>'}</header>
    <h1>${L.locked ? 'Essai terminé' : L.licensed ? 'Activation' : 'Activer Namako'}</h1>
    <p class="sub">${intro}</p>
    ${L.clockSuspect ? '<p class="note">La date de votre téléphone semble incorrecte. Corrigez-la dans les réglages.</p>' : ''}
    ${L.licensed ? '' : `
    <h2 style="margin-top:24px">1. Payer</h2>
    <p>${esc(CFG.PRICE_LABEL)}</p>
    ${CFG.PAYMENTS.map((p) => `<div class="item"><span><b>${esc(p.name)}</b><br><small class="note">${esc(p.number)}${p.holder ? ', ' + esc(p.holder) : ''}</small></span>
      <button data-act="copy" data-text="${esc(p.number)}">Copier</button></div>`).join('')}
    <h2 style="margin-top:24px">2. Envoyer mon identifiant</h2>
    <p class="idbox">${esc(L.installId)}</p>
    <div class="actions col"><button data-act="copy" data-text="${esc(L.installId)}">Copier mon identifiant</button>
    <a class="btn" href="https://wa.me/${esc(CFG.ADMIN_WHATSAPP)}?text=${encodeURIComponent(msg)}">Envoyer par WhatsApp</a>
    <a class="btn" href="sms:${esc(CFG.ADMIN_PHONE)}?body=${encodeURIComponent(msg)}">Envoyer par SMS</a></div>
    <h2 style="margin-top:24px">3. Entrer mon code</h2>
    <form data-form="activate"><label>Code d’activation<textarea name="code" rows="4" required autocomplete="off" autocapitalize="characters" spellcheck="false"></textarea></label>
    <p class="note" id="actmsg" role="status"></p><button class="primary">Activer</button></form>`}
    ${L.locked ? '<h2 style="margin-top:24px">Mes cours</h2><div class="actions col"><button data-act="backup-now">Sauvegarder mes cours</button></div>' : ''}`;
}

function renderUpdate() {
  app.innerHTML = `<h1>Mise à jour requise</h1>
    <p class="sub">Une nouvelle version de Namako est nécessaire. Connectez-vous à Internet puis touchez le bouton. Vos cours ne seront pas effacés.</p>
    <p class="note" id="upmsg" role="status"></p>
    <div class="actions col"><button class="primary" data-act="do-update">Mettre à jour</button></div>`;
}

async function copyText(btn) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(btn.dataset.text); }
  catch { const ta = document.createElement('textarea'); ta.value = btn.dataset.text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  btn.textContent = 'Copié';
  setTimeout(() => (btn.textContent = old), 1500);
}

async function doUpdate(btn) {
  btn.disabled = true;
  btn.textContent = 'Mise à jour…';
  try {
    await Promise.all(CFG.APP_FILES.map((f) => fetch(f, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error('échec'); })));
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    location.reload();
  } catch {
    btn.disabled = false;
    btn.textContent = 'Mettre à jour';
    document.querySelector('#upmsg').textContent = 'Impossible de télécharger la mise à jour. Vérifiez votre connexion Internet et réessayez.';
  }
}

// Bloque l'app seulement si l'appareil est en ligne ET que la version est trop ancienne
async function checkVersion() {
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    if (!r.ok) return;
    const { min } = await r.json();
    if (min > CFG.APP_BUILD) { blocked = true; render(); }
  } catch { /* hors ligne : on ne bloque pas */ }
}

/* ---------- Révision et progression ---------- */

function reviewCard() {
  if (!DB.activeLessons().length) return '';
  const due = RV.dueLessons(null, Date.now(), 9999).length;
  const st = RV.streaks();
  return `<div class="today"><div><b>${due ? plural(due, 'leçon à revoir', 'leçons à revoir') : 'Rien à revoir aujourd’hui'}</b>
    <small>${st.cur ? `Série : ${plural(st.cur, 'jour', 'jours')}` : 'Révisez aujourd’hui pour lancer votre série'}</small></div>
    ${due ? '<button class="primary" data-act="review">Réviser</button>' : ''}</div>`;
}

function renderReview() {
  if (!session) return go({ name: 'home' });
  if (session.i >= session.ids.length) return renderSummary();
  const l = find('lessons', session.ids[session.i]);
  const sub = l && find('subjects', l.subjectId);
  if (!l || l.deletedAt || !sub || sub.deletedAt) { session.i++; return renderReview(); }
  const fs = DB.state.meta.fontSize || 18;
  const lbl = (r) => RV.intervalLabel(RV.INTERVALS[RV.nextBox(l.box, r)]);
  app.innerHTML = `
    <header class="top"><button class="ghost" data-act="end-review">Terminer</button><span class="sub">${session.i + 1} sur ${session.ids.length}</span></header>
    <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${session.ids.length}" aria-valuenow="${session.i}"><i style="width:${Math.round((session.i / session.ids.length) * 100)}%"></i></div>
    <h1 class="sh" style="--c:${sub.color}">${esc(l.title)}</h1><p class="sub">${esc(sub.name)}</p>
    ${session.revealed
      ? `<article class="read" style="font-size:${fs}px">${md(l.content) || '<p class="empty">Cette leçon est vide.</p>'}</article>
         <div class="readbar rate"><button class="danger" data-act="rate" data-r="0">À revoir<small>${lbl(0)}</small></button>
         <button data-act="rate" data-r="1">Encore un effort<small>${lbl(1)}</small></button>
         <button class="primary" data-act="rate" data-r="2">Je maîtrise<small>${lbl(2)}</small></button></div>`
      : `<p class="empty">Rappelez-vous l’essentiel de cette leçon, puis affichez-la pour vérifier.</p>
         <div class="readbar"><button class="primary" data-act="reveal">Afficher la leçon</button></div>`}`;
  scrollTo(0, 0);
}

function renderSummary() {
  const c = session.counts;
  const n = c[0] + c[1] + c[2];
  const st = RV.streaks();
  app.innerHTML = `
    <header class="top"><span></span></header>
    <h1>Séance terminée</h1><p class="sub">${plural(n, 'leçon revue', 'leçons revues')}.${st.cur ? ` Série en cours : ${plural(st.cur, 'jour', 'jours')}.` : ''}</p>
    <div class="tiles"><div><b>${c[2]}</b><small>maîtrisées</small></div><div><b>${c[1]}</b><small>encore un effort</small></div><div><b>${c[0]}</b><small>à revoir</small></div></div>
    <div class="actions col"><button class="primary" data-act="end-review">Retour à l’accueil</button><button data-act="stats">Voir ma progression</button></div>`;
}

function renderStats() {
  const st = RV.streaks();
  const week = RV.lastDays(7);
  const max = Math.max(1, ...week.map((d) => d.count));
  const b = RV.breakdown();
  app.innerHTML = `
    <header class="top"><button class="ghost" data-act="back">Retour</button></header>
    <h1>Progression</h1>
    <div class="tiles"><div><b>${st.cur}</b><small>jours d’affilée</small></div><div><b>${st.best}</b><small>meilleure série</small></div><div><b>${DB.state.reviews.length}</b><small>révisions</small></div></div>
    <h2>7 derniers jours</h2>
    <div class="chart" role="img" aria-label="Révisions par jour : ${week.map((d) => d.label + ' ' + d.count).join(', ')}">
      ${week.map((d) => `<div><span>${d.count}</span><i style="height:${Math.round((d.count / max) * 80) + 3}px"></i><small>${d.label}</small></div>`).join('')}</div>
    <h2 style="margin-top:24px">Vos leçons</h2>
    <div class="stack"><span style="flex:${b.mastered};background:var(--accent)"></span><span style="flex:${b.learning};background:#E9A23B"></span></div>
    <p class="note">${plural(b.mastered, 'maîtrisée', 'maîtrisées')}, ${plural(b.learning, 'à consolider', 'à consolider')}, ${plural(b.fresh, 'nouvelle', 'nouvelles')}.</p>
    <h2 style="margin-top:24px">Badges</h2>
    <div class="badges">${RV.badges().map((x) => `<div class="badge ${x.ok ? 'on' : ''}"><b>${esc(x.name)}</b><small>${x.ok ? 'Obtenu' : esc(x.desc)}</small></div>`).join('')}</div>`;
}

/* ---------- Lecture, éditeur, voix ---------- */

// Mise en forme simple : # titres, **gras**, listes "- "
function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const out = [];
  let list = false;
  for (const line of text.split('\n')) {
    const li = line.match(/^\s*[-•]\s+(.*)/);
    if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('');
}

function renderLesson(id) {
  const l = find('lessons', id);
  const s = l && find('subjects', l.subjectId);
  if (!l || l.deletedAt || !s || s.deletedAt) return go({ name: 'home' });
  const fs = DB.state.meta.fontSize || 18;
  app.innerHTML = `
    <header class="top"><button class="ghost" data-act="back">Retour</button><button class="ghost" data-act="edit-lesson" data-id="${id}">Modifier</button></header>
    <h1 class="sh" style="--c:${s.color}">${esc(l.title)}</h1>
    <p class="sub">${esc(s.name)}${(l.tags || []).length ? ' – ' + esc(l.tags.join(', ')) : ''}</p>
    <article class="read" style="font-size:${fs}px">${md(l.content) || '<p class="empty">Cette leçon est vide. Touchez Modifier pour écrire.</p>'}</article>
    <div class="readbar"><button data-act="font-" aria-label="Réduire le texte">A−</button><button data-act="font+" aria-label="Agrandir le texte">A+</button>
    ${'speechSynthesis' in window ? `<button class="primary" id="listen" data-act="listen">${speakingNow ? 'Arrêter' : 'Écouter'}</button>` : ''}</div>`;
}

// Barre d'outils de l'éditeur : mise en forme et symboles scientifiques
const SYMS = ['²', '³', '√', 'π', '∑', '∫', '≤', '≥', '≠', '±', '×', '÷', '∞', 'α', 'β', 'θ', 'Δ', '→', '°', '½'];
const toolbar = () => `<div class="tb" aria-label="Mise en forme et symboles">
  <button type="button" data-act="spell">Orthographe</button>
  <button type="button" data-ins="**" data-wrap="1" aria-label="Gras"><b>G</b></button>
  <button type="button" data-ins="# " data-line="1">Titre</button>
  <button type="button" data-ins="- " data-line="1">Liste</button>
  ${SYMS.map((s) => `<button type="button" data-ins="${s}">${s}</button>`).join('')}</div>
  <div id="spellout"></div>`;

function insertAt(btn) {
  const ta = dlg.querySelector('textarea');
  if (!ta) return;
  const { ins, wrap, line } = btn.dataset;
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
  let text, pos;
  if (wrap) { text = v.slice(0, a) + ins + v.slice(a, b) + ins + v.slice(b); pos = b + ins.length; }
  else if (line) { const ls = a ? v.lastIndexOf('\n', a - 1) + 1 : 0; text = v.slice(0, ls) + ins + v.slice(ls); pos = a + ins.length; }
  else { text = v.slice(0, a) + ins + v.slice(b); pos = a + ins.length; }
  ta.value = text;
  ta.setSelectionRange(pos, pos);
  ta.focus();
}

let speakingNow = false;
function setListen(on) {
  speakingNow = on;
  const b = document.querySelector('#listen');
  if (b) b.textContent = on ? 'Arrêter' : 'Écouter';
}
function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  setListen(false);
}
function toggleSpeak(l) {
  if (!('speechSynthesis' in window)) return message('Lecture vocale indisponible', 'Ce navigateur ne sait pas lire le texte à voix haute.');
  if (speakingNow) return stopSpeak();
  const text = (l.title + '. ' + l.content).replace(/[#*_]/g, '');
  const chunks = text.split(/(?<=[.!?\n])\s*/).flatMap((c) => c.match(/.{1,200}(\s|$)/gs) || []).map((c) => c.trim()).filter(Boolean);
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
  if (voices.length && !voice) return message('Voix française absente', 'Installez une voix française dans les réglages du téléphone (Langue, puis Synthèse vocale) pour écouter vos leçons.');
  speechSynthesis.cancel();
  chunks.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c);
    u.lang = 'fr-FR';
    if (voice) u.voice = voice;
    if (i === chunks.length - 1) u.onend = () => setListen(false);
    speechSynthesis.speak(u);
  });
  setListen(true);
}

/* ---------- Actions ---------- */

async function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id, label, store, mode } = el.dataset;
  switch (act) {
    case 'open-subject': return go({ name: 'subject', id });
    case 'back':
      if (view.name === 'lesson') return go(view.from || { name: 'home' });
      query = ''; picked = ''; return go({ name: 'home' });
    case 'new-subject': return subjectDialog();
    case 'edit-subject': return subjectDialog(find('subjects', id));
    case 'trash-subject': await DB.put('subjects', { ...find('subjects', id), deletedAt: Date.now() }); closeDlg(); return go({ name: 'home' });
    case 'new-lesson': return lessonDialog(null, id);
    case 'open-lesson': return go({ name: 'lesson', id, from: view });
    case 'trash-lesson': await DB.put('lessons', { ...find('lessons', id), deletedAt: Date.now() }); closeDlg(); return view.name === 'lesson' ? go(view.from || { name: 'home' }) : render();
    case 'pick': picked = label; query = label; document.querySelector('#q').value = label; return refreshList();
    case 'menu': return backupDialog();
    case 'stats': return go({ name: 'stats' });
    case 'activate': closeDlg(); return go({ name: 'activate' });
    case 'copy': return copyText(el);
    case 'do-update': return doUpdate(el);
    case 'review': {
      const ids = RV.dueLessons(id || null, Date.now(), 20).map((l) => l.id);
      if (!ids.length) return message('Rien à revoir', 'Toutes vos leçons sont à jour. Revenez demain !');
      session = { ids, i: 0, revealed: false, counts: [0, 0, 0], requeued: new Set() };
      return go({ name: 'review' });
    }
    case 'reveal': session.revealed = true; return render();
    case 'rate': {
      const r = Number(el.dataset.r);
      const l = find('lessons', session.ids[session.i]);
      const now = Date.now();
      await DB.put('lessons', { ...l, ...RV.schedule(l, r, now) });
      await DB.put('reviews', { id: DB.uid(), lessonId: l.id, rating: r, at: now, day: RV.dayKey(now) });
      session.counts[r]++;
      if (r === 0 && !session.requeued.has(l.id)) { session.requeued.add(l.id); session.ids.push(l.id); }
      session.i++;
      session.revealed = false;
      return render();
    }
    case 'end-review': session = null; return go({ name: 'home' });
    case 'edit-lesson': return lessonDialog(find('lessons', id));
    case 'import-menu': return importMenu();
    case 'import-txt': closeDlg(); return txtInput.click();
    case 'import-pdf': closeDlg(); return pdfInput.click();
    case 'import-cam': closeDlg(); return camInput.click();
    case 'import-gal': closeDlg(); return galInput.click();
    case 'cancel-scan': SC.cancel(); return closeDlg();
    case 'share-subject': return shareSubject(id);
    case 'share-app': return qrDialog();
    case 'share-link': return shareLink();
    case 'font-': case 'font+': {
      const fs = Math.min(30, Math.max(14, (DB.state.meta.fontSize || 18) + (act === 'font+' ? 2 : -2)));
      await DB.setMeta('fontSize', fs);
      return render();
    }
    case 'listen': return toggleSpeak(find('lessons', view.id));
    case 'spell': return runSpell();
    case 'spell-fix': {
      const ta = dlg.querySelector('textarea[name=content]');
      ta.value = Spell.replaceAll(ta.value, el.dataset.from, el.dataset.to);
      return showSpell();
    }
    case 'spell-ignore': sessionIgnore.add(el.dataset.w); return showSpell();
    case 'spell-add': await DB.setMeta('userWords', [...(DB.state.meta.userWords || []), el.dataset.w]); return showSpell();
    case 'close': return closeDlg();
    case 'backup-now': {
      const r = await BK.exportBackup();
      if (!r) return;
      render();
      return message(r === 'shared' ? 'Sauvegarde terminée' : 'Fichier enregistré',
        r === 'shared' ? 'Vérifiez que le fichier est bien arrivé à destination (par exemple dans la conversation WhatsApp choisie).'
                       : 'Le partage n’est pas disponible ici. Le fichier est dans vos Téléchargements : joignez-le à un message WhatsApp ou copiez-le ailleurs.');
    }
    case 'restore': return document.querySelector('#file').click();
    case 'persist': await navigator.storage.persist(); return backupDialog();
    case 'trash': return trashDialog();
    case 'restore-item': await DB.put(store, { ...find(store, id), deletedAt: null }); trashDialog(); return render();
    case 'delete-item': if (confirm('Supprimer définitivement ? Cette action est irréversible.')) { await DB.removeForever(store, id); trashDialog(); render(); } return;
    case 'install': installEvt.prompt(); await installEvt.userChoice; installEvt = null; return render();
    case 'apply': {
      if (mode === 'subject') {
        try {
          const r = await BK.applySubject(pending);
          pending = null;
          render();
          return message('Matière ajoutée', `« ${r.name} » : ${plural(r.added, 'leçon ajoutée', 'leçons ajoutées')}, ${plural(r.updated, 'leçon mise à jour', 'leçons mises à jour')}.`);
        } catch (err) { return message('Ajout impossible', err.message); }
      }
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
    const base = id ? find('lessons', id) : { id: DB.uid(), subjectId: f.dataset.subject, createdAt: Date.now(), deletedAt: null, mastery: 0, nextReviewAt: null, source: f.dataset.source || 'manual' };
    await DB.put('lessons', { ...base, title, content: String(d.get('content')), tags });
  }
  closeDlg();
  render();
});

app.addEventListener('submit', async (e) => {
  if (e.target.dataset.form !== 'activate') return;
  e.preventDefault();
  const ok = await LIC.activate(new FormData(e.target).get('code'));
  if (ok) { view = { name: 'home' }; render(); message('Namako est activé', 'Merci ! Votre activation est valable à vie sur ce téléphone.'); }
  else document.querySelector('#actmsg').textContent = 'Ce code ne correspond pas à cet identifiant. Vérifiez qu’il est complet, sans lettre manquante.';
});
app.addEventListener('click', onClick);
dlg.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-ins]')) e.preventDefault(); });
dlg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ins]');
  if (b) return insertAt(b);
  if (e.target === dlg) { if (!dlg.querySelector('#pbar')) closeDlg(); } else onClick(e);
});
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

// Import d'un fichier texte (.txt, .md) comme nouvelle leçon de la matière ouverte
const txtInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.txt,.md,text/plain', hidden: true });
document.body.append(txtInput);
txtInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || view.name !== 'subject') return;
  const text = (await f.text()).replace(/\r\n/g, '\n').trim();
  if (!text) return message('Fichier vide', 'Ce fichier ne contient aucun texte.');
  if (text.length > 500000) return message('Fichier trop volumineux', 'Choisissez un fichier de moins de 500 000 caractères.');
  const l = await DB.put('lessons', { id: DB.uid(), subjectId: view.id, title: f.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Leçon importée', content: text, tags: [], source: 'txt', createdAt: Date.now(), deletedAt: null, mastery: 0, nextReviewAt: null });
  go({ name: 'lesson', id: l.id, from: view });
});

const mkInput = (accept, extra = {}) => {
  const i = Object.assign(document.createElement('input'), { type: 'file', accept, hidden: true, ...extra });
  document.body.append(i);
  return i;
};
const pdfInput = mkInput('application/pdf,.pdf');
const camInput = mkInput('image/*');
camInput.setAttribute('capture', 'environment');
const galInput = mkInput('image/*', { multiple: true });
for (const [input, kind] of [[pdfInput, 'pdf'], [camInput, 'cam'], [galInput, 'gal']]) {
  input.addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) runImport(kind, files);
  });
}
dlg.addEventListener('cancel', (e) => { if (dlg.querySelector('#pbar')) e.preventDefault(); });
dlg.addEventListener('close', () => Spell.release());

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !LIC.lic.installId) return;
  const was = LIC.lic.locked;
  await LIC.touch();
  if (LIC.lic.locked !== was) render();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

(async () => {
  try { await DB.init(); }
  catch { app.innerHTML = '<p class="empty">Le stockage du navigateur est indisponible (navigation privée ?). Ouvrez Namako dans une fenêtre normale.</p>'; return; }
  await LIC.init();
  render();
  checkVersion();
})();
