// Essai gratuit, identifiant d'installation et vérification du code d'activation.
// Le code est une signature ECDSA (P-256) de l'identifiant : l'app ne contient que la
// clé publique, donc elle peut vérifier un code mais jamais en fabriquer un.
import { CFG } from './config.js';

export const APP_VERSION = 4;
export const PREFIX = 'NAMAKO-LIFETIME|';
const DAY = 864e5;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const enc = new TextEncoder();

const ls = {
  get(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, String(v)); } catch { /* ignoré */ } },
};
const LS_KEYS = { installId: 'nk_id', trialStart: 'nk_t', lastSeen: 'nk_s', activation: 'nk_a' };

export const b64uEncode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64uDecode = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

// NK-XXXX-XXXX-XXXX ; O, I et L sont corrigés en 0, 1 et 1 (ils n'existent pas dans l'alphabet)
export function canonicalId(s) {
  const a = String(s || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^A-Z0-9]/g, '');
  const m = a.match(/^NK([A-Z0-9]{12})$/);
  return m ? `NK-${m[1].slice(0, 4)}-${m[1].slice(4, 8)}-${m[1].slice(8)}` : null;
}

function newId() {
  const r = crypto.getRandomValues(new Uint8Array(12));
  const c = [...r].map((b) => ALPHABET[b % 32]).join('');
  return `NK-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

export async function verifyCode(id, code) {
  if (!CFG.PUBLIC_KEY) return false;
  try {
    const pub = await crypto.subtle.importKey('raw', b64uDecode(CFG.PUBLIC_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sig = b64uDecode(String(code).replace(/\s+/g, ''));
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, enc.encode(PREFIX + id));
  } catch { return false; }
}

let S = { id: '', start: 0, eff: 0, active: false, ready: false };

// Écrit chaque valeur à deux endroits (base de l'app et stockage local du navigateur)
async function persist(store, values) {
  for (const [k, v] of Object.entries(values)) {
    if (String(store.get(k)) !== String(v)) await store.set(k, v);
    ls.set(LS_KEYS[k], v);
  }
}

// store = { get(clé), set(clé, valeur) } ; now sert aux tests
export async function init(store, now = Date.now()) {
  const id = canonicalId(store.get('installId')) || canonicalId(ls.get(LS_KEYS.installId)) || newId();
  const starts = [Number(store.get('trialStart')), Number(ls.get(LS_KEYS.trialStart))].filter((x) => x > 0);
  const start = starts.length ? Math.min(...starts) : now;
  // Anti-retour d'horloge : on retient la date la plus avancée déjà vue (avance limitée à 3 jours par lancement)
  const seen = Math.max(Number(store.get('lastSeen')) || 0, Number(ls.get(LS_KEYS.lastSeen)) || 0);
  const eff = Math.max(now, seen);
  const newSeen = seen ? Math.max(seen, Math.min(now, seen + 3 * DAY)) : now;
  const code = store.get('activation') || ls.get(LS_KEYS.activation) || '';
  const active = !!code && (await verifyCode(id, code));
  await persist(store, { installId: id, trialStart: start, lastSeen: newSeen, ...(active ? { activation: code } : {}) });
  S = { id, start, eff, active, ready: true };
}

// state : 'unconfigured' (pas encore de clé publique, aucun blocage), 'trial', 'expired', 'active'
export function status(now = Date.now()) {
  if (!S.ready || !CFG.PUBLIC_KEY) return { state: 'unconfigured', id: S.id };
  if (S.active) return { state: 'active', id: S.id };
  const left = Math.ceil((S.start + CFG.TRIAL_DAYS * DAY - Math.max(now, S.eff)) / DAY);
  return left > 0 ? { state: 'trial', daysLeft: left, id: S.id } : { state: 'expired', id: S.id };
}

export async function activate(store, code) {
  const c = String(code).replace(/\s+/g, '');
  if (!c || !(await verifyCode(S.id, c))) return false;
  S.active = true;
  await persist(store, { activation: c });
  return true;
}
