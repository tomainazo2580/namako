// Dictée vocale : le texte prononcé s'écrit dans la fiche. Utilise la reconnaissance vocale du navigateur.
// Mode « sans connexion » si le téléphone propose un pack de langue installé, sinon Internet est nécessaire.
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

  async function start() {
    if (!supported) { onError('La dictée n’est pas disponible sur ce navigateur. Utilisez le micro du clavier.'); onState(false); return; }
    let local = false;
    if (SR.available) {
      try { local = (await SR.available({ langs: [lang], processLocally: true })) === 'available'; } catch { /* mode connecté */ }
    }
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
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
          // Certains téléphones renvoient deux fois la même phrase : on ignore le doublon immédiat
          if (chunk && !(chunk === lastFinal && now - lastAt < 1500)) { onChunk(chunk); lastFinal = chunk; lastAt = now; }
        } else interim += r[0].transcript;
      }
      onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      active = false;
      onError(MESSAGES[e.error] || 'La dictée s’est arrêtée.');
    };
    // La reconnaissance s'arrête d'elle-même après un silence : on la relance tant que l'étudiant n'a pas arrêté
    rec.onend = () => {
      if (!active) { onInterim(''); onState(false); return; }
      try { rec.start(); } catch { active = false; onState(false); }
    };
    active = true;
    try { rec.start(); onState(true, { local }); }
    catch { active = false; onError('La dictée n’a pas pu démarrer.'); onState(false); }
  }

  function stop() { active = false; if (rec) { try { rec.stop(); } catch { onState(false); } } else onState(false); }
  return { start, stop };
}
