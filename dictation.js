// Dictée vocale : le texte prononcé s'écrit dans la fiche. Utilise la reconnaissance vocale du navigateur.
// Connecté à Internet : service du navigateur (meilleure qualité). Sans connexion : pack de langue local si disponible.
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const supported = !!SR;

const MESSAGES = {
  'not-allowed': 'Autorisez le micro pour Namako dans les réglages du navigateur, puis réessayez.',
  'service-not-allowed': 'La dictée est bloquée sur ce téléphone. Utilisez le micro du clavier.',
  'audio-capture': 'Aucun micro n’a été trouvé.',
  network: 'La dictée a besoin d’Internet sur ce téléphone.',
  'language-not-supported': 'Le français n’est pas disponible pour la dictée sur ce téléphone.',
};

// Commandes vocales : « virgule », « à la ligne », « point » (en fin de phrase), etc.
const w = (s) => new RegExp(`\\s*(?<!\\p{L})${s}(?!\\p{L})`, 'giu');
const CMDS = [
  [w("point d['’]interrogation"), ' ?'],
  [w("point d['’]exclamation"), ' !'],
  [w('point[- ]virgule'), ' ;'],
  [w('deux[- ]points'), ' :'],
  [w('virgule'), ','],
  [new RegExp('\\s*(?<!\\p{L})point(?=\\s*$|\\s+(?:à la ligne|nouvelle ligne|nouveau paragraphe))', 'iu'), '.'],
  [w('nouveau paragraphe'), '\n\n'],
  [w('(?:à la ligne|nouvelle ligne)'), '\n'],
  [w('ouvrez la parenthèse'), ' ('],
  [w('fermez la parenthèse'), ')'],
];

export function applyCommands(raw) {
  let t = ' ' + String(raw).trim();
  for (const [re, rep] of CMDS) t = t.replace(re, rep);
  return t
    .replace(/\n +/g, '\n')
    .replace(/\( +/g, '(')
    .replace(/([.!?]\s+|\n)(\p{L})/gu, (m, p, l) => p + l.toUpperCase())
    .trim();
}

// Ajuste l'espace et la majuscule selon le texte qui précède le curseur
export function fit(before, chunk) {
  let c = chunk;
  const tail = before.replace(/[ \t]+$/, '');
  if (!tail || /[.!?\n]$/.test(tail)) c = c.replace(/^(\s*)(\p{L})/u, (m, s, l) => s + l.toUpperCase());
  if (before && !/[\s(]$/.test(before) && !/^[\s.,)]/.test(c)) c = ' ' + c;
  return c;
}

export function create({ onChunk, onInterim, onState, onError, lang = 'fr-FR' }) {
  let rec = null;
  let active = false;
  let lastFinal = '';
  let lastAt = 0;
  let fails = 0;

  // Une phrase à la fois puis relance : plus fiable que le mode « continu » sur Android
  function resume() {
    if (!active) { onState(false); return; }
    try { rec.start(); fails = 0; }
    catch {
      if (++fails >= 4) { active = false; onError('La dictée n’a pas pu continuer. Touchez Dicter pour reprendre.'); onState(false); }
      else setTimeout(resume, 300);
    }
  }

  async function start() {
    if (!supported) { onError('La dictée n’est pas disponible sur ce navigateur. Utilisez le micro du clavier.'); onState(false); return; }
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    let local = false;
    if (!online) {
      if (SR.available) {
        try { local = (await SR.available({ langs: [lang], processLocally: true })) === 'available'; } catch { /* indisponible */ }
      }
      if (!local) { onError(MESSAGES.network); onState(false); return; }
    }
    rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    if (local) rec.processLocally = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const chunk = applyCommands(r[0].transcript);
          const now = Date.now();
          if (chunk && !(chunk === lastFinal && now - lastAt < 1500)) { onChunk(chunk); lastFinal = chunk; lastAt = now; }
        } else interim += r[0].transcript;
      }
      onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      active = false;
      onError(MESSAGES[e.error] || `La dictée s’est arrêtée (${e.error || 'erreur inconnue'}).`);
    };
    rec.onend = () => {
      onInterim('');
      if (!active) { onState(false); return; }
      setTimeout(resume, 250);
    };
    active = true;
    try { rec.start(); onState(true, { local }); }
    catch { active = false; onError('La dictée n’a pas pu démarrer.'); onState(false); }
  }

  function stop() {
    active = false;
    if (rec) { try { rec.stop(); } catch { onState(false); } } else onState(false);
  }
  return { start, stop };
}
