// Générateur de QR Code (mode octets, correction d'erreur M, versions 1 à 10).
// Fonctionne hors ligne : aucune bibliothèque à télécharger.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function remainder(data, n) {
  const gen = generator(n);
  const res = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ res.shift();
    res.push(0);
    if (f) for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], f);
  }
  return res;
}

// Par version : [mots de données d'un bloc court, nombre de blocs courts, nombre de blocs longs (+1 mot), mots de correction par bloc]
const M_TABLE = {
  1: [16, 1, 0, 10], 2: [28, 1, 0, 16], 3: [44, 1, 0, 26], 4: [32, 2, 0, 18], 5: [43, 2, 0, 24],
  6: [27, 4, 0, 16], 7: [31, 4, 0, 18], 8: [38, 2, 2, 22], 9: [36, 3, 2, 22], 10: [43, 4, 1, 26],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

const grid = (n) => Array.from({ length: n }, () => new Array(n).fill(false));
const bit = (v, i) => ((v >>> i) & 1) === 1;

function setF(m, fn, x, y, v) { m[y][x] = v; fn[y][x] = true; }

function drawFormat(m, fn, mask) {
  const n = m.length;
  const data = (0 << 3) | mask;                 // niveau M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i++) setF(m, fn, 8, i, bit(bits, i));
  setF(m, fn, 8, 7, bit(bits, 6));
  setF(m, fn, 8, 8, bit(bits, 7));
  setF(m, fn, 7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) setF(m, fn, 14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) setF(m, fn, n - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) setF(m, fn, 8, n - 15 + i, bit(bits, i));
  setF(m, fn, 8, n - 8, true);                  // module sombre fixe
}

function drawPatterns(m, fn, version) {
  const n = m.length;
  for (let i = 0; i < n; i++) { setF(m, fn, 6, i, i % 2 === 0); setF(m, fn, i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < n && y >= 0 && y < n) setF(m, fn, x, y, d !== 2 && d !== 4);
    }
  }
  const pos = ALIGN[version], last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(m, fn, pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  drawFormat(m, fn, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      setF(m, fn, a, b, bit(bits, i));
      setF(m, fn, b, a, bit(bits, i));
    }
  }
}

function placeData(m, fn, codewords) {
  const n = m.length;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!fn[y][x] && i < codewords.length * 8) { m[y][x] = bit(codewords[i >>> 3], 7 - (i & 7)); i++; }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
function applyMask(m, fn, mask) {
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
}

function penalty(m) {
  const n = m.length;
  let p = 0, dark = 0;
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let a = 0; a < n; a++) {
    for (const line of [m[a], m.map((row) => row[a])]) {
      let run = 1;
      for (let i = 1; i < n; i++) {
        if (line[i] === line[i - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
      }
      for (let i = 0; i + 11 <= n; i++) {
        const w = line.slice(i, i + 11).map(Number);
        if (w.every((v, k) => v === A[k]) || w.every((v, k) => v === B[k])) p += 40;
      }
    }
    for (let x = 0; x < n; x++) if (m[a][x]) dark++;
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const v = m[y][x];
    if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) p += 3;
  }
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const [d, s, l] = M_TABLE[v];
    if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= (d * s + (d + 1) * l) * 8) { version = v; break; }
  }
  if (!version) throw new Error('Texte trop long pour le QR Code.');
  const [dpb, ns, nl, ecpb] = M_TABLE[version];
  const capBytes = dpb * ns + (dpb + 1) * nl;

  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, capBytes * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < capBytes; pad ^= 0xec ^ 0x11) data.push(pad);

  const blocks = [];
  let pos = 0;
  for (let b = 0; b < ns + nl; b++) {
    const blk = data.slice(pos, pos + dpb + (b >= ns ? 1 : 0));
    pos += blk.length;
    blocks.push({ data: blk, ec: remainder(blk, ecpb) });
  }
  const codewords = [];
  for (let i = 0; i <= dpb; i++) for (const b of blocks) if (i < b.data.length) codewords.push(b.data[i]);
  for (let i = 0; i < ecpb; i++) for (const b of blocks) codewords.push(b.ec[i]);

  const n = version * 4 + 17;
  const m = grid(n), fn = grid(n);
  drawPatterns(m, fn, version);
  placeData(m, fn, codewords);

  let best = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(m, fn, mask);
    drawFormat(m, fn, mask);
    const sc = penalty(m);
    if (sc < bestScore) { bestScore = sc; best = mask; }
    applyMask(m, fn, mask);
  }
  applyMask(m, fn, best);
  drawFormat(m, fn, best);
  return m;
}

// QR Code en image vectorielle (noir sur blanc, bordure de 4 modules exigée par les lecteurs)
export function qrSvg(text, quiet = 4) {
  const m = qrMatrix(text);
  const n = m.length + quiet * 2;
  let d = '';
  m.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      let len = 1;
      while (x + len < row.length && row[x + len]) len++;
      d += `M${x + quiet},${y + quiet}h${len}v1h-${len}z`;
      x += len;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
