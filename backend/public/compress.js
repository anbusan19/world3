// Squeezes an image under a size limit in the browser, so people never have to find a compressor.
//   const { blob, bytes, width, height, changed } = await compressImage(file, { maxBytes: 100 * 1024, maxSide: 1280 });
// Tries WebP (keeps transparency) at falling quality, then shrinks the picture a step at a time until it fits.
// An animated GIF becomes a still image, because the browser only draws its first frame.
const SMALLEST_SIDE = 64;

const load = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
  img.src = url;
});

const encode = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function compressImage(file, { maxBytes = 100 * 1024, maxSide = 1280, target = 0.96 } = {}) {
  const goal = Math.floor(maxBytes * target); // aim a little under the limit
  const img = await load(file);
  const w0 = img.naturalWidth; const h0 = img.naturalHeight;
  const okType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
  // already small enough, the right size and a still format: leave it alone
  if (file.size <= maxBytes && Math.max(w0, h0) <= maxSide && okType) return { blob: file, bytes: file.size, width: w0, height: h0, changed: false };

  let scale = Math.min(1, maxSide / Math.max(w0, h0));
  for (let round = 0; round < 12; round++) {
    const w = Math.max(1, Math.round(w0 * scale)); const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      let blob = await encode(canvas, 'image/webp', q);
      if (!blob || blob.type !== 'image/webp') { // an old browser without WebP: JPEG on white
        const flat = document.createElement('canvas'); flat.width = w; flat.height = h;
        const g = flat.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(canvas, 0, 0);
        blob = await encode(flat, 'image/jpeg', q);
      }
      if (blob && blob.size <= goal) return { blob, bytes: blob.size, width: w, height: h, changed: true };
    }
    if (Math.min(w, h) <= SMALLEST_SIDE) break;
    scale *= 0.82; // still too big at the lowest quality: make the picture smaller
  }
  throw new Error(`Could not get that image under ${Math.round(maxBytes / 1024)} KB. Try a simpler picture.`);
}
