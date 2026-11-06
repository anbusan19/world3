// Turns a flat logo (a PNG with a transparent or white background and a dark mark) into a 3D coin with the mark raised on both faces.
//   node trace-logo.mjs <logo.png> <out.glb> [faceColor] [markColor]
// The outline is traced from the picture itself (marching squares on a smoothed, up-sampled copy), cleaned up, triangulated with
// earcut, and extruded. Nothing is redrawn by hand, so the 3D mark is the real logo.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import earcut from '../../landing/node_modules/earcut/src/earcut.js';
import { Scene, hex } from './glb.js';
import { parseGlb } from '../../backend/src/glb.js';

const { PNG } = createRequire(import.meta.url)('../../node_modules/pngjs');
const [src, out, faceHex = '#F4F1EA', markHex = '#0B0B0F'] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node trace-logo.mjs <logo.png> <out.glb> [face] [mark]'); process.exit(1); }

// ---- 1. the picture as a "how dark is this pixel" field in 0..1 ----------------------------------------------------------
const png = PNG.sync.read(readFileSync(src));
const W = png.width; const H = png.height;
const dark = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = png.data[i * 4], g = png.data[i * 4 + 1], b = png.data[i * 4 + 2], a = png.data[i * 4 + 3] / 255;
  dark[i] = a * (1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255);
}

// ---- 2. up-sample 3x with a light blur so the traced edge is smooth, padded with empty space so every contour closes ------
const S = 3; const PAD = 3;
const FW = W * S + PAD * 2; const FH = H * S + PAD * 2;
const field = new Float32Array(FW * FH);
const sample = (x, y) => { // bilinear, x and y in source pixels
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x))); const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const x1 = Math.min(W - 1, x0 + 1); const y1 = Math.min(H - 1, y0 + 1);
  const fx = x - Math.floor(x); const fy = y - Math.floor(y);
  const v = (xx, yy) => dark[yy * W + xx];
  return (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy;
};
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) field[(y + PAD) * FW + x + PAD] = sample((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5);
{ // one pass of a 3x3 box blur
  const tmp = new Float32Array(field);
  for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += tmp[(y + dy) * FW + x + dx];
    field[y * FW + x] = s / 9;
  }
}

// ---- 3. marching squares: undirected segments between points on grid edges, stitched into closed loops ---------------------
const T = 0.5;
const pts = new Map(); // edge key -> {x, y}
const adj = new Map(); // edge key -> [edge keys]
const edgePoint = (kind, x, y) => {
  const key = `${kind}${x},${y}`;
  if (!pts.has(key)) {
    if (kind === 'h') { const a = field[y * FW + x], b = field[y * FW + x + 1]; pts.set(key, { x: x + (T - a) / (b - a), y }); }
    else { const a = field[y * FW + x], b = field[(y + 1) * FW + x]; pts.set(key, { x, y: y + (T - a) / (b - a) }); }
  }
  return key;
};
const link = (p, q) => { for (const [a, b] of [[p, q], [q, p]]) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); } };
for (let y = 0; y < FH - 1; y++) for (let x = 0; x < FW - 1; x++) {
  const a = field[y * FW + x] >= T, b = field[y * FW + x + 1] >= T, c = field[(y + 1) * FW + x + 1] >= T, d = field[(y + 1) * FW + x] >= T;
  const idx = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
  if (idx === 0 || idx === 15) continue;
  const Tp = () => edgePoint('h', x, y); const Bp = () => edgePoint('h', x, y + 1); const Lp = () => edgePoint('v', x, y); const Rp = () => edgePoint('v', x + 1, y);
  const centre = (field[y * FW + x] + field[y * FW + x + 1] + field[(y + 1) * FW + x + 1] + field[(y + 1) * FW + x]) / 4 >= T;
  const segs = {
    1: [[Lp, Bp]], 2: [[Bp, Rp]], 3: [[Lp, Rp]], 4: [[Tp, Rp]], 6: [[Tp, Bp]], 7: [[Tp, Lp]], 8: [[Tp, Lp]], 9: [[Tp, Bp]], 11: [[Tp, Rp]], 12: [[Lp, Rp]], 13: [[Bp, Rp]], 14: [[Lp, Bp]],
    5: centre ? [[Tp, Lp], [Bp, Rp]] : [[Tp, Rp], [Lp, Bp]], 10: centre ? [[Tp, Rp], [Lp, Bp]] : [[Tp, Lp], [Bp, Rp]],
  }[idx];
  for (const [p, q] of segs) link(p(), q());
}
const used = new Set(); const loops = [];
for (const start of adj.keys()) {
  if (used.has(start)) continue;
  const loop = []; let prev = null; let cur = start;
  while (cur && !used.has(cur)) {
    used.add(cur); loop.push(pts.get(cur));
    const next = adj.get(cur).find((n) => n !== prev && !used.has(n)) ?? null;
    prev = cur; cur = next;
  }
  if (loop.length > 8) loops.push(loop);
}

// ---- 4. clean up: Douglas-Peucker, then work out which loops are outlines and which are holes ---------------------------
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i].x * q.y - q.x * p[i].y; } return s / 2; };
function simplify(p, eps) {
  const keep = new Array(p.length).fill(false); keep[0] = keep[p.length - 1] = true;
  const rec = (i, j) => {
    let max = 0; let at = -1;
    const a = p[i], b = p[j]; const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((p[k].x - a.x) * dy - (p[k].y - a.y) * dx) / len; if (d > max) { max = d; at = k; } }
    if (max > eps && at > 0) { keep[at] = true; rec(i, at); rec(at, j); }
  };
  rec(0, p.length - 1);
  return p.filter((_, i) => keep[i]);
}
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
// a closed loop is split at the point farthest from its start, and each half is simplified on its own
const simplifyLoop = (l, eps) => {
  let far = 0; let best = -1;
  l.forEach((p, i) => { const d = Math.hypot(p.x - l[0].x, p.y - l[0].y); if (d > best) { best = d; far = i; } });
  const a = simplify(l.slice(0, far + 1), eps); const b = simplify([...l.slice(far), l[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
};
const simple = loops.map((l) => simplifyLoop(l, 0.45)).filter((l) => l.length >= 4);
const depth = simple.map((l, i) => simple.reduce((n, m, j) => n + (i !== j && inside(l[0], m) ? 1 : 0), 0));

// to coordinates in the coin: radius 1, centred, y up
const cx = (W * S) / 2 + PAD; const cy = (H * S) / 2 + PAD; const R = (W * S) / 2;
const conv = (l) => l.map((p) => ({ x: (p.x - cx) / R, y: -(p.y - cy) / R }));
const shapes = [];
simple.forEach((l, i) => {
  if (depth[i] % 2 === 1) return;
  let outer = conv(l); if (area(outer) < 0) outer = outer.reverse(); // counter-clockwise
  const holes = [];
  simple.forEach((m, j) => {
    if (depth[j] !== depth[i] + 1 || !inside(m[0], l)) return;
    let h = conv(m); if (area(h) > 0) h = h.reverse(); // clockwise
    holes.push(h);
  });
  shapes.push({ outer, holes });
});
console.log(`traced ${shapes.length} shapes with ${shapes.reduce((n, s) => n + s.holes.length, 0)} holes from ${loops.length} loops`);

// ---- 5. build the coin ------------------------------------------------------------------------------------------------------
const THICK = 0.22; const FACE = THICK / 2; const RAISE = 0.045; const SEG = 96;
const scene = new Scene('coin');
const bin = (hexColor) => { const c = hex(hexColor); if (!scene.bins.has(c)) scene.bins.set(c, { color: c, pos: [], nor: [] }); return scene.bins.get(c); };
const tri = (b, a, p, q, n) => { for (const v of [a, p, q]) { b.pos.push(v[0], v[1], v[2]); b.nor.push(n[0], n[1], n[2]); } };
const mark = bin(markHex); const face = bin(faceHex);

// rim: the black edge of the coin and its two flat caps
for (let i = 0; i < SEG; i++) {
  const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
  const p0 = [Math.cos(a0), Math.sin(a0)], p1 = [Math.cos(a1), Math.sin(a1)];
  const nm = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
  tri(mark, [p0[0], p0[1], -FACE], [p1[0], p1[1], -FACE], [p1[0], p1[1], FACE], nm); tri(mark, [p0[0], p0[1], -FACE], [p1[0], p1[1], FACE], [p0[0], p0[1], FACE], nm);
  for (const s of [1, -1]) { // cap: a black disc under the cream face
    const z = FACE * s; const n = [0, 0, s];
    if (s === 1) tri(mark, [0, 0, z], [p0[0], p0[1], z], [p1[0], p1[1], z], n); else tri(mark, [0, 0, z], [p1[0], p1[1], z], [p0[0], p0[1], z], n);
    const r = 0.97; const z2 = z + s * 0.004; // the cream face, a hair above the cap
    if (s === 1) tri(face, [0, 0, z2], [p0[0] * r, p0[1] * r, z2], [p1[0] * r, p1[1] * r, z2], n); else tri(face, [0, 0, z2], [p1[0] * r, p1[1] * r, z2], [p0[0] * r, p0[1] * r, z2], n);
  }
}
// the raised mark, on the front as drawn and on the back mirrored so it reads correctly from behind
for (const s of [1, -1]) {
  const z0 = FACE * s + s * 0.004; const z1 = z0 + s * RAISE;
  const X = (x) => x * s; // mirror on the back
  for (const { outer, holes } of shapes) {
    const rings = [outer, ...holes]; const flat = []; const holeAt = [];
    rings.forEach((r, i) => { if (i > 0) holeAt.push(flat.length / 2); for (const p of r) flat.push(p.x, p.y); });
    const idx = earcut(flat, holeAt);
    for (let i = 0; i < idx.length; i += 3) {
      const P = [0, 1, 2].map((k) => [flat[idx[i + k] * 2], flat[idx[i + k] * 2 + 1]]);
      const ar = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      const ccw = ar > 0; // counter-clockwise seen from +z
      const V = P.map((p) => [X(p[0]), p[1], z1]);
      if ((ccw && s === 1) || (!ccw && s === -1)) tri(mark, V[0], V[1], V[2], [0, 0, s]); else tri(mark, V[0], V[2], V[1], [0, 0, s]);
    }
    for (const ring of rings) { // walls: for a counter-clockwise outline (clockwise for holes) the solid is on the left of each edge
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]; const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
        const n = [(dy / len) * s, (-dx / len), 0]; // outward, flipped in x on the back
        const A0 = [X(a.x), a.y, z0], B0 = [X(b.x), b.y, z0], A1 = [X(a.x), a.y, z1], B1 = [X(b.x), b.y, z1];
        if (s === 1) { tri(mark, A0, B0, B1, [dy / len, -dx / len, 0]); tri(mark, A0, B1, A1, [dy / len, -dx / len, 0]); }
        else { tri(mark, B0, A0, A1, [-dy / len, -dx / len, 0]); tri(mark, B0, A1, B1, [-dy / len, -dx / len, 0]); }
      }
    }
  }
}
const buf = scene.glb(4);
const info = parseGlb(buf);
writeFileSync(out, buf);
console.log(`${out}: ${(buf.length / 1024).toFixed(0)} KB, ${info.triangles} triangles, ${info.bbox.size.map((v) => v.toFixed(2)).join(' x ')} m`);
