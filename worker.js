// Namako : service d'import de pages web (Cloudflare Worker).
// Reçoit /api/page?url=..., va chercher la page et renvoie son texte lisible (sans menus, scripts, publicités).
// Ce fichier n'est PAS publié comme page du site (voir .assetsignore) : il ne sert qu'au Worker.
const MAX_BYTES = 150000;      // on ne lit pas plus de 150 Ko de la page (le Worker gratuit dispose de peu de temps de calcul)
const MAX_CHARS = 60000;       // et on ne renvoie pas plus de 60 000 caractères
const TIMEOUT_MS = 8000;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç', icirc: 'î',
  iuml: 'ï', ocirc: 'ô', ugrave: 'ù', ucirc: 'û', oelig: 'œ', euro: '€', deg: '°', times: '×', middot: '·', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç',
};
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
  }
  return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
});

// Ces balises et tout ce qu'elles contiennent sont ignorés
const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'aside', 'form', 'iframe', 'button', 'select', 'template', 'head', 'dialog']);
const BLOCK = new Set(['p', 'div', 'br', 'tr', 'section', 'blockquote', 'pre', 'ul', 'ol', 'table', 'article', 'main', 'figure', 'figcaption', 'dd', 'dt', 'hr']);

const END_SCRIPT = /<\/script/gi;
const END_STYLE = /<\/style/gi;
const isNameChar = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const text = (s) => (s.indexOf('&') < 0 ? s : decode(s));

// Parcourt la page une seule fois, sans bibliothèque (écrit à la main : le Worker gratuit n'a que peu de temps de calcul)
export function extract(html) {
  const n = html.length;
  let i = 0, out = '', skipTag = '', skipDepth = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { if (!skipDepth) out += text(html.slice(i)); break; }
    if (lt > i && !skipDepth) out += text(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    let j = lt + 1;
    const closing = html.charCodeAt(j) === 47;
    if (closing) j++;
    let k = j;
    while (k < n && isNameChar(html.charCodeAt(k))) k++;
    if (k === j) { if (!skipDepth) out += '<'; i = lt + 1; continue; }   // un « < » qui n'ouvre pas une balise
    const name = html.slice(j, k).toLowerCase();
    let e = k, q = 0;                                                    // fin de la balise, en respectant les guillemets
    for (; e < n; e++) {
      const c = html.charCodeAt(e);
      if (q) { if (c === q) q = 0; } else if (c === 34 || c === 39) q = c; else if (c === 62) break;
    }
    const selfClosing = html.charCodeAt(e - 1) === 47;
    i = e + 1;
    if (skipDepth) {
      if (name === skipTag) { skipDepth += closing ? -1 : 1; if (!skipDepth) skipTag = ''; }
      continue;
    }
    if (SKIP.has(name) && !closing) {
      if (name === 'script' || name === 'style') {         // le contenu peut contenir des « < » : on saute jusqu'à la fin
        const endRe = name === 'script' ? END_SCRIPT : END_STYLE;
        endRe.lastIndex = i;
        const m = endRe.exec(html);
        i = m ? m.index : n;
      } else if (!selfClosing) { skipTag = name; skipDepth = 1; }
      continue;
    }
    if (name.length === 2 && name.charCodeAt(0) === 104 && name.charCodeAt(1) >= 49 && name.charCodeAt(1) <= 54) out += closing ? '\n' : '\n\n' + (name === 'h1' ? '# ' : name === 'h2' ? '## ' : '### ');
    else if (name === 'li') out += closing ? '' : '\n- ';
    else if (name === 'td' || name === 'th') out += ' ';
    else if (BLOCK.has(name)) out += '\n';
  }
  return out
    .replace(/[ \t\u00a0\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/^(#{1,3}|-)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// On préfère le contenu de <article> ou de <main> : c'est là que se trouve le texte de la page
function mainPart(html) {
  for (const tag of ['article', 'main']) {
    const open = new RegExp('<' + tag + '[\\s>]', 'gi');
    const close = new RegExp('</' + tag + '\\s*>', 'gi');
    let best = null, m;
    while ((m = open.exec(html))) {
      close.lastIndex = m.index;
      const c = close.exec(html);
      const end = c ? c.index : html.length;                 // page coupée avant la fin : on prend jusqu'au bout de ce qu'on a lu
      if (!best || end - m.index > best[1] - best[0]) best = [m.index, end];
      if (!c) break;
      open.lastIndex = end;
    }
    if (best && best[1] - best[0] > 600) return html.slice(best[0], best[1]);
  }
  const b = html.search(/<body[\s>]/i);
  return b >= 0 ? html.slice(b) : html;
}

function titleOf(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const t = og ? og[1] : (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  return decode(t).replace(/\s+/g, ' ').trim().slice(0, 120);
}

// Adresses acceptées : sites publics en http/https seulement (jamais le réseau interne)
export function checkTarget(raw, ownHost = '') {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h === 'localhost') return null;
  if (/\.(local|localhost|internal|lan|home|corp)$/.test(h) || h === ownHost) return null;
  if (u.username || u.password) return null;
  return u;
}

async function readLimited(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= MAX_BYTES) { truncated = true; await reader.cancel(); break; }
  }
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  return { bytes: all, truncated };
}

function decodeBytes(bytes, contentType) {
  let cs = (/charset=([\w-]+)/i.exec(contentType) || [])[1];
  if (!cs) cs = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(bytes.slice(0, 2048))) || [])[1];
  try { return new TextDecoder(cs || 'utf-8').decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

export async function importPage(request) {
  const url = new URL(request.url);
  const target = checkTarget(url.searchParams.get('url') || '', url.hostname);
  if (!target) return json({ error: 'invalid' }, 400);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(target.href, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NamakoReader/1.0)', Accept: 'text/html,text/plain;q=0.9' } });
  } catch (e) {
    clearTimeout(timer);
    return json({ error: e && e.name === 'AbortError' ? 'timeout' : 'unreachable' }, 502);
  }
  clearTimeout(timer);
  const finalUrl = res.url ? checkTarget(res.url, url.hostname) : target;
  if (!finalUrl) return json({ error: 'invalid' }, 400);                      // redirigé vers une adresse interdite
  if (!res.ok) return json({ error: 'unreachable' }, 502);
  const type = res.headers.get('content-type') || '';
  const isText = /text\/plain/i.test(type);
  if (!isText && !/html/i.test(type)) return json({ error: 'type' }, 415);
  const { bytes, truncated: cut } = await readLimited(res);
  const html = decodeBytes(bytes, type);
  let text = isText ? html.trim() : extract(mainPart(html));
  if (text.length < 80) return json({ error: 'empty' }, 422);
  let truncated = cut;
  if (text.length > MAX_CHARS) { text = text.slice(0, text.lastIndexOf('\n', MAX_CHARS) > 1000 ? text.lastIndexOf('\n', MAX_CHARS) : MAX_CHARS); truncated = true; }
  return json({ title: isText ? finalUrl.hostname : titleOf(html), text, url: finalUrl.href, truncated });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/page') return env && env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    if (request.method !== 'GET') return json({ error: 'method' }, 405);
    // L'application ajoute cet en-tête : cela écarte les appels qui ne viennent pas de Namako
    const site = request.headers.get('Sec-Fetch-Site');
    if (request.headers.get('X-Namako') !== '1' || (site && site !== 'same-origin')) return json({ error: 'forbidden' }, 403);
    return importPage(request);
  },
};
