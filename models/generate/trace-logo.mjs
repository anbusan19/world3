// Turns a flat logo into a 3D coin with the mark raised on both faces. The outline is traced from the picture itself (marching squares on
// a smoothed, up-sampled copy), cleaned up, triangulated with earcut and extruded, so the 3D mark is the real logo, not a redraw.
//
//   node trace-logo.mjs <logo.png> <out.glb> [faceColor] [markColor] [rimColor]     one colour: a dark mark on transparent
//   node trace-logo.mjs --spec <dir/spec.json> <out.glb>                              several colours (made by split-colours.py)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import earcut from '../../landing/node_modules/earcut/src/earcut.js';
import { Scene, hex } from './glb.js';
import { parseGlb } from '../../backend/src/glb.js';

const { PNG } = createRequire(import.meta.url)('../../node_modules/pngjs');
const args = process.argv.slice(2);
let faceHex = '#F4F1EA'; let rimHex; let out; let layerDefs;
if (args[0] === '--spec') {
  const specPath = args[1]; out = args[2];
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  faceHex = spec.face ?? faceHex; rimHex = spec.rim;
  layerDefs = spec.layers.map((l) => ({ png: path.join(path.dirname(specPath), l.png), color: l.color }));
} else {
  const [src, o, face = '#F4F1EA', mark = '#0B0B0F', rim] = args;
  if (!src || !o) { console.error('usage: node trace-logo.mjs <logo.png> <out.glb> [face] [mark] [rim]\n       node trace-logo.mjs --spec <dir/spec.json> <out.glb>'); process.exit(1); }
  out = o; faceHex = face; rimHex = rim ?? mark;
  layerDefs = [{ png: src, color: mark }];
}

// ---- trace one picture into outlines (with holes), in coin units: radius 1, centred, y up -------------------------------------
function traceShapes(file) {
  const png = PNG.sync.read(readFileSync(file));
  const W = png.width; const H = png.height;
  const dark = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = png.data[i * 4], g = png.data[i * 4 + 1], b = png.data[i * 4 + 2], a = png.data[i * 4 + 3] / 255;
    dark[i] = a * (1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255);
  }
  const S = 3; const PAD = 3;
  const FW = W * S + PAD * 2; const FH = H * S + PAD * 2;
  const field = new Float32Array(FW * FH);
  const sample = (x, y) => {
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(x))); const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const x1 = Math.min(W - 1, x0 + 1); const y1 = Math.min(H - 1, y0 + 1);
    const fx = x - Math.floor(x); const fy = y - Math.floor(y);
    const v = (xx, yy) => dark[yy * W + xx];
    return (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy;
  };
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) field[(y + PAD) * FW + x + PAD] = sample((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5);
  { const tmp = new Float32Array(field);
    for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
      let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += tmp[(y + dy) * FW + x + dx];
      field[y * FW + x] = s / 9;
    } }

  const T = 0.5;
  const pts = new Map(); const adj = new Map();
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
    while (cur && !used.has(cur)) { used.add(cur); loop.push(pts.get(cur)); const next = adj.get(cur).find((n) => n !== prev && !used.has(n)) ?? null; prev = cur; cur = next; }
    if (loop.length > 8) loops.push(loop);
  }

  const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i].x * q.y - q.x * p[i].y; } return s / 2; };
  function simplify(p, eps) {
    const keep = new Array(p.length).fill(false); keep[0] = keep[p.length - 1] = true;
    const rec = (i, j) => {
      let max = 0; let at = -1; const a = p[i], b = p[j]; const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
      for (let k = i + 1; k < j; k++) { const d = Math.abs((p[k].x - a.x) * dy - (p[k].y - a.y) * dx) / len; if (d > max) { max = d; at = k; } }
      if (max > eps && at > 0) { keep[at] = true; rec(i, at); rec(at, j); }
    };
    rec(0, p.length - 1);
    return p.filter((_, i) => keep[i]);
  }
  const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
  const simplifyLoop = (l, eps) => {
    let far = 0; let best = -1;
    l.forEach((p, i) => { const d = Math.hypot(p.x - l[0].x, p.y - l[0].y); if (d > best) { best = d; far = i; } });
    return [...simplify(l.slice(0, far + 1), eps).slice(0, -1), ...simplify([...l.slice(far), l[0]], eps).slice(0, -1)];
  };
  // drop specks: loops far smaller than the picture
  const simple = loops.map((l) => simplifyLoop(l, 1.1)).filter((l) => l.length >= 4 && Math.abs(area(l)) > FW * FH * 0.00002);
  const depth = simple.map((l, i) => simple.reduce((n, m, j) => n + (i !== j && inside(l[0], m) ? 1 : 0), 0));
  const cx = (W * S) / 2 + PAD; const cy = (H * S) / 2 + PAD; const R = (W * S) / 2;
  const conv = (l) => l.map((p) => ({ x: (p.x - cx) / R, y: -(p.y - cy) / R }));
  const shapes = [];
  simple.forEach((l, i) => {
    if (depth[i] % 2 === 1) return;
    let outer = conv(l); if (area(outer) < 0) outer = outer.reverse();
    const holes = [];
    simple.forEach((m, j) => { if (depth[j] !== depth[i] + 1 || !inside(m[0], l)) return; let h = conv(m); if (area(h) > 0) h = h.reverse(); holes.push(h); });
    shapes.push({ outer, holes });
  });
  return shapes;
}
const layers = layerDefs.map((d) => ({ color: d.color, shapes: traceShapes(d.png) }));
console.log(`traced ${layers.map((l) => `${l.shapes.length} shapes`).join(' + ')}`);

// ---- build the coin ----------------------------------------------------------------------------------------------------------
const THICK = 0.22; const FACE = THICK / 2; const RAISE = 0.04; const SEG = 96;
const scene = new Scene('coin');
const bin = (hexColor) => { const c = hex(hexColor); if (!scene.bins.has(c)) scene.bins.set(c, { color: c, pos: [], nor: [] }); return scene.bins.get(c); };
const tri = (b, a, p, q, n) => { for (const v of [a, p, q]) { b.pos.push(v[0], v[1], v[2]); b.nor.push(n[0], n[1], n[2]); } };
const face = bin(faceHex); const rim = bin(rimHex ?? layerDefs[0].color);

for (let i = 0; i < SEG; i++) {
  const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
  const p0 = [Math.cos(a0), Math.sin(a0)], p1 = [Math.cos(a1), Math.sin(a1)];
  const nm = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
  tri(rim, [p0[0], p0[1], -FACE], [p1[0], p1[1], -FACE], [p1[0], p1[1], FACE], nm); tri(rim, [p0[0], p0[1], -FACE], [p1[0], p1[1], FACE], [p0[0], p0[1], FACE], nm);
  for (const s of [1, -1]) {
    const z = FACE * s; const n = [0, 0, s];
    if (s === 1) tri(rim, [0, 0, z], [p0[0], p0[1], z], [p1[0], p1[1], z], n); else tri(rim, [0, 0, z], [p1[0], p1[1], z], [p0[0], p0[1], z], n);
    const r = 0.97; const z2 = z + s * 0.004;
    if (s === 1) tri(face, [0, 0, z2], [p0[0] * r, p0[1] * r, z2], [p1[0] * r, p1[1] * r, z2], n); else tri(face, [0, 0, z2], [p1[0] * r, p1[1] * r, z2], [p0[0] * r, p0[1] * r, z2], n);
  }
}
for (const s of [1, -1]) {
  layers.forEach((layer, rank) => {
    const mark = bin(layer.color);
    const z0 = FACE * s + s * 0.004; const z1 = z0 + s * (RAISE + rank * 0.012); // smaller colours stand a little proud
    const X = (x) => x * s; // mirrored on the back so it reads correctly from behind
    for (const { outer, holes } of layer.shapes) {
      const rings = [outer, ...holes]; const flat = []; const holeAt = [];
      rings.forEach((r, i) => { if (i > 0) holeAt.push(flat.length / 2); for (const p of r) flat.push(p.x, p.y); });
      const idx = earcut(flat, holeAt);
      for (let i = 0; i < idx.length; i += 3) {
        const P = [0, 1, 2].map((k) => [flat[idx[i + k] * 2], flat[idx[i + k] * 2 + 1]]);
        const ar = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
        const ccw = ar > 0; const V = P.map((p) => [X(p[0]), p[1], z1]);
        if ((ccw && s === 1) || (!ccw && s === -1)) tri(mark, V[0], V[1], V[2], [0, 0, s]); else tri(mark, V[0], V[2], V[1], [0, 0, s]);
      }
      for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]; const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
        const A0 = [X(a.x), a.y, z0], B0 = [X(b.x), b.y, z0], A1 = [X(a.x), a.y, z1], B1 = [X(b.x), b.y, z1];
        if (s === 1) { tri(mark, A0, B0, B1, [dy / len, -dx / len, 0]); tri(mark, A0, B1, A1, [dy / len, -dx / len, 0]); }
        else { tri(mark, B0, A0, A1, [-dy / len, -dx / len, 0]); tri(mark, B0, A1, B1, [-dy / len, -dx / len, 0]); }
      }
    }
  });
}
const buf = scene.glb(4);
const info = parseGlb(buf);
writeFileSync(out, buf);
console.log(`${out}: ${(buf.length / 1024).toFixed(0)} KB, ${info.triangles} triangles, ${info.bbox.size.map((v) => v.toFixed(2)).join(' x ')} m`);
