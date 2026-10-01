// Essai gratuit, identifiant d'installation et activation. Tout est vérifié hors ligne.
import * as DB from './db.js';
import { PUBLIC_KEY, TRIAL_DAYS } from './config.js';
import { newInstallId, verifyCode } from './codec.js';

const LS = 'namako-lic';
const DAY = 864e5;

export const io = { save: (k, v) => DB.setMeta(k, v) };
export const lic = {
  publicKey: PUBLIC_KEY, enforced: false, installId: '', trialStart: 0, lastSeen: 0, code: '',
  licensed: false, daysLeft: TRIAL_DAYS, locked: false, clockSuspect: false,
};

const readLS = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };

// Les informations sont gardées à deux endroits (base + stockage du navigateur)
async function persist() {
  const values = { installId: lic.installId, trialStart: lic.trialStart, licenseCode: lic.code, lastSeen: lic.lastSeen };
  for (const [k, v] of Object.entries(values)) if (DB.state.meta[k] !== v) await io.save(k, v);
  try { localStorage.setItem(LS, JSON.stringify({ installId: lic.installId, trialStart: lic.trialStart, code: lic.code, lastSeen: lic.lastSeen })); } catch {}
}

async function tick(now) {
  lic.clockSuspect = now < lic.lastSeen - DAY;
  const eff = Math.max(now, lic.lastSeen);                 // une horloge reculée ne rend pas de jours d'essai
  if (!lic.lastSeen || now - lic.lastSeen <= 45 * DAY) lic.lastSeen = eff;
  await persist();
  lic.licensed = lic.enforced && !!lic.code && (await verifyCode(lic.publicKey, lic.installId, lic.code));
  lic.daysLeft = Math.max(0, Math.ceil((TRIAL_DAYS * DAY - (eff - lic.trialStart)) / DAY));
  lic.locked = lic.enforced && !lic.licensed && lic.daysLeft <= 0;
}

export async function init(now = Date.now()) {
  const m = DB.state.meta;
  const ls = readLS();
  lic.enforced = !!lic.publicKey;
  lic.installId = m.installId || ls.installId || newInstallId();
  lic.trialStart = m.trialStart || ls.trialStart || now;
  lic.code = m.licenseCode || ls.code || '';
  lic.lastSeen = Math.max(m.lastSeen || 0, ls.lastSeen || 0);
  await tick(now);
}

export const touch = () => tick(Date.now());

export async function activate(input) {
  if (!lic.enforced || !(await verifyCode(lic.publicKey, lic.installId, input))) return false;
  lic.code = String(input).trim();
  await persist();
  await tick(Date.now());
  return true;
}
