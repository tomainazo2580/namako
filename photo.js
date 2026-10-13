// Photos : réduction avant enregistrement (économise l'espace) et conversion pour la copie de sécurité.
const MAX_SIDE = 1600;
const QUALITY = 0.72;

export async function compressImage(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error('Cette image ne peut pas être lue. Essayez une photo au format JPG ou PNG.'); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';                       // fond blanc pour les images transparentes
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('La photo n’a pas pu être préparée.');
  return { blob, width: w, height: h, name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' };
}

export async function blobToB64(blob) {
  const u8 = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type });
}
