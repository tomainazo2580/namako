// Outil administrateur : fabrique les codes d'activation. La clé privée est chiffrée par votre
// mot de passe et ne quitte jamais ce navigateur (sauf sauvegarde chiffrée que vous copiez).
import { makeKeys, unlockKey, signCode, isValidId, clean, fmt } from './codec.js';

const root = document.querySelector('#adm');
const KEY = 'namako-admin-key';
const LOG = 'namako-admin-log';
let priv = null;
let result = null;

const $ = (s) => root.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const note = (t) => { const n = $('#msg'); if (n) n.textContent = t; };

async function copy(text, btn) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  btn.textContent = 'Copié';
  setTimeout(() => (btn.textContent = old), 1500);
}

function show() {
  const blob = read(KEY, null);
  if (!blob) return setup();
  if (!priv) return unlock(blob);
  return main(blob);
}

function setup() {
  root.innerHTML = `<h1>Administration</h1>
    <p class="sub">Première utilisation : créez vos clés. Le mot de passe protège la clé qui fabrique les codes. S’il est perdu, il ne peut pas être récupéré.</p>
    <form id="create" style="margin-top:16px"><label>Mot de passe (8 caractères minimum)<input type="password" name="p1" minlength="8" required autocomplete="new-password"></label>
    <label>Confirmer le mot de passe<input type="password" name="p2" minlength="8" required autocomplete="new-password"></label>
    <p class="note" id="msg" role="status"></p><button class="primary">Créer mes clés</button></form>
    <h2 style="margin-top:32px">J’ai déjà une sauvegarde</h2>
    <form id="restore"><label>Sauvegarde chiffrée de ma clé<textarea name="blob" rows="4" required></textarea></label><button>Restaurer</button></form>`;
  $('#create').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    if (d.get('p1') !== d.get('p2')) return note('Les deux mots de passe sont différents.');
    note('Création en cours…');
    const { blob, privateKey } = await makeKeys(String(d.get('p1')));
    localStorage.setItem(KEY, JSON.stringify(blob));
    priv = privateKey;
    created(blob);
  };
  $('#restore').onsubmit = (e) => {
    e.preventDefault();
    try {
      const blob = JSON.parse(String(new FormData(e.target).get('blob')).trim());
      if (!blob.ct || !blob.salt || !blob.iv || !blob.pub) throw new Error('invalide');
      localStorage.setItem(KEY, JSON.stringify(blob));
      show();
    } catch { alert('Cette sauvegarde n’est pas valide.'); }
  };
}

function created(blob) {
  const line = `export const PUBLIC_KEY = ${JSON.stringify(blob.pub)};`;
  root.innerHTML = `<h1>Clés créées</h1>
    <h2>1. Sauvegardez votre clé</h2>
    <p>Copiez la sauvegarde chiffrée et gardez-la en lieu sûr (message à vous-même, notes). Si ce navigateur est vidé sans cette sauvegarde, vous ne pourrez plus fabriquer de codes.</p>
    <button class="primary" id="c-bak">Copier la sauvegarde chiffrée</button>
    <h2 style="margin-top:24px">2. Installez la clé publique dans l’app</h2>
    <p>Copiez la ligne ci-dessous. Dans GitHub, ouvrez config.js, touchez le crayon, remplacez la ligne qui commence par « export const PUBLIC_KEY » par celle-ci, puis Commit changes.</p>
    <textarea readonly rows="6" class="mono">${esc(line)}</textarea>
    <div class="actions"><button id="c-pub">Copier la ligne</button><button class="primary" id="c-go">Continuer</button></div>`;
  $('#c-bak').onclick = (e) => copy(JSON.stringify(blob), e.target);
  $('#c-pub').onclick = (e) => copy(line, e.target);
  $('#c-go').onclick = show;
}

function unlock(blob) {
  root.innerHTML = `<h1>Administration</h1>
    <form id="unlock" style="margin-top:16px"><label>Mot de passe<input type="password" name="p" required autocomplete="current-password"></label>
    <p class="note" id="msg" role="status"></p><button class="primary">Déverrouiller</button></form>
    <h2 style="margin-top:32px">Clé publique</h2><p class="note">Pour vérifier le contenu de config.js.</p>
    <button id="showpub">Copier la ligne PUBLIC_KEY</button>
    <h2 style="margin-top:32px">Mot de passe oublié ?</h2>
    <p class="note">Il ne peut pas être récupéré. Vous pouvez effacer cette clé et en créer une nouvelle. Il faudra alors remplacer la ligne PUBLIC_KEY dans config.js, et les codes déjà donnés cesseront de fonctionner.</p>
    <button class="danger" id="reset">Effacer ma clé et recommencer</button>`;
  $('#unlock').onsubmit = async (e) => {
    e.preventDefault();
    note('Vérification…');
    try { priv = await unlockKey(blob, String(new FormData(e.target).get('p'))); show(); }
    catch { note('Mot de passe incorrect.'); }
  };
  $('#showpub').onclick = (e) => copy(`export const PUBLIC_KEY = ${JSON.stringify(blob.pub)};`, e.target);
  $('#reset').onclick = () => {
    if (!confirm('Effacer votre clé d’administration ? Les codes déjà donnés cesseront de fonctionner dès que la nouvelle clé sera installée.')) return;
    localStorage.removeItem(KEY);
    priv = null;
    show();
  };
}

function main(blob) {
  const log = read(LOG, []);
  root.innerHTML = `<h1>Générer un code</h1>
    <form id="gen" style="margin-top:16px"><label>Identifiant du client<input name="id" required autocomplete="off" autocapitalize="characters" placeholder="K7QP-2M4X-9WRD-A3TH"></label>
    <label>Nom ou numéro Mobile Money (pour votre registre)<input name="name" autocomplete="off"></label>
    <p class="note" id="msg" role="status"></p><button class="primary">Générer le code</button></form>
    ${result ? `<div style="margin-top:16px"><p class="note">Code pour ${esc(fmt(result.id, 4))} :</p>
      <textarea readonly rows="5" class="mono">${esc(result.code)}</textarea>
      <div class="actions"><button id="r-copy">Copier le code</button>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent('Votre code d’activation Namako :\n' + result.code)}">Envoyer sur WhatsApp</a></div></div>` : ''}
    <h2 style="margin-top:32px">Registre (${log.length})</h2>
    ${log.slice(0, 20).map((x, i) => `<div class="item"><span>${esc(x.name || 'Sans nom')}<br><small class="note">${esc(fmt(x.id, 4))}, ${date(x.at)}</small></span><button data-i="${i}">Copier le code</button></div>`).join('') || '<p class="empty">Aucun code généré pour l’instant.</p>'}
    ${log.length ? '<div class="actions"><button id="l-all">Copier le registre complet</button></div>' : ''}
    <h2 style="margin-top:32px">Ma clé</h2>
    <div class="actions col"><button id="k-bak">Copier la sauvegarde chiffrée</button><button id="k-pub">Copier la ligne PUBLIC_KEY</button><button id="k-lock">Verrouiller</button></div>`;

  $('#gen').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    const id = clean(d.get('id'));
    if (!isValidId(id)) return note('Identifiant invalide : il doit contenir 16 lettres ou chiffres, par exemple K7QP-2M4X-9WRD-A3TH.');
    const prev = read(LOG, []).find((x) => x.id === id);
    if (prev && !confirm(`Cet identifiant a déjà reçu un code le ${date(prev.at)}. En générer un nouveau ?`)) return;
    const code = await signCode(priv, id);
    const entries = read(LOG, []);
    entries.unshift({ id, name: String(d.get('name')).trim(), at: Date.now(), code });
    localStorage.setItem(LOG, JSON.stringify(entries.slice(0, 500)));
    result = { id, code };
    show();
  };
  root.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => copy(log[b.dataset.i].code, b)));
  if ($('#r-copy')) $('#r-copy').onclick = (e) => copy(result.code, e.target);
  if ($('#l-all')) $('#l-all').onclick = (e) => copy(log.map((x) => [date(x.at), x.name, fmt(x.id, 4), x.code].join(';')).join('\n'), e.target);
  $('#k-bak').onclick = (e) => copy(JSON.stringify(blob), e.target);
  $('#k-pub').onclick = (e) => copy(`export const PUBLIC_KEY = ${JSON.stringify(blob.pub)};`, e.target);
  $('#k-lock').onclick = () => { priv = null; result = null; show(); };
}

show();
