// Codes d'activation : signature ECDSA P-256 de l'identifiant d'installation.
// L'app ne contient que la clé publique (vérification). La clé privée reste dans admin.html.
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };
const enc = new TextEncoder();

export function b32encode(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = ((val << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHA[(val << (5 - bits)) & 31];
  return out;
}

export function b32decode(str) {
  let bits = 0, val = 0;
  const out = [];
  for (const ch of str) {
    const i = ALPHA.indexOf(ch);
    if (i < 0) throw new Error('caractère invalide');
    val = ((val << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

// Tolère minuscules, espaces, tirets et confusions courantes (0/O, 1/I, 8/B)
export const clean = (s) => String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B');
export const fmt = (s, n = 5) => (s.match(new RegExp(`.{1,${n}}`, 'g')) || []).join('-');
export const isValidId = (s) => /^[A-Z2-7]{16}$/.test(clean(s));
export const newInstallId = () => fmt(b32encode(crypto.getRandomValues(new Uint8Array(10))), 4);

const message = (id) => enc.encode('NAMAKO1|' + clean(id));

export async function signCode(privateKey, installId) {
  const sig = await crypto.subtle.sign(SIG, privateKey, message(installId));
  return fmt(b32encode(new Uint8Array(sig)), 5);
}

export async function verifyCode(publicJwk, installId, code) {
  try {
    const key = await crypto.subtle.importKey('jwk', publicJwk, ALG, false, ['verify']);
    const sig = b32decode(clean(code));
    if (sig.length !== 64) return false;
    return await crypto.subtle.verify(SIG, key, sig, message(installId));
  } catch { return false; }
}

/* ---- Clés de l'administrateur (utilisées seulement par admin.html) ---- */
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function wrapKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function makeKeys(pass) {
  const kp = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrapKey(pass, salt), enc.encode(JSON.stringify(privJwk))));
  return { blob: { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct), pub }, privateKey: kp.privateKey };
}

export async function unlockKey(blob, pass) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, await wrapKey(pass, unb64(blob.salt)), unb64(blob.ct));
  return crypto.subtle.importKey('jwk', JSON.parse(new TextDecoder().decode(pt)), ALG, false, ['sign']);
}
