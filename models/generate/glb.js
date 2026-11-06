// A tiny GLB writer and solid-shape kit for building cartoon landmarks from flat-coloured primitives.
// Every primitive is convex, so the outside of each face is found by pointing it away from the shape's own centre.
// Shapes are placed with a transform stack: s.at({ x, y, z, rx, ry, rz, sx, sy, sz }, () => { ...children... }).

const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; // column-major 4x4
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const T = (x, y, z) => { const m = I(); m[12] = x; m[13] = y; m[14] = z; return m; };
const S = (x, y, z) => { const m = I(); m[0] = x; m[5] = y; m[10] = z; return m; };
const RX = (a) => { const c = Math.cos(a), s = Math.sin(a), m = I(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
const RY = (a) => { const c = Math.cos(a), s = Math.sin(a), m = I(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
const RZ = (a) => { const c = Math.cos(a), s = Math.sin(a), m = I(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const DEG = Math.PI / 180;

export const hex = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2)); // sRGB -> linear

export class Scene {
  constructor(name) { this.name = name; this.m = I(); this.stack = []; this.bins = new Map(); }

  at({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}, fn) {
    this.stack.push(this.m);
    this.m = mul(mul(mul(mul(mul(this.m, T(x, y, z)), RY(ry * DEG)), RZ(rz * DEG)), RX(rx * DEG)), S(sx, sy, sz));
    fn?.();
    this.m = this.stack.pop();
  }

  // a convex solid: triangles in local space plus a point inside it. Faces are turned to point away from that point.
  emit(color, tris, inside) {
    const c = apply(this.m, inside);
    const bin = this.bins.get(color) ?? { color, pos: [], nor: [] };
    this.bins.set(color, bin);
    for (const t of tris) {
      const [a, b, d] = t.map((p) => apply(this.m, p));
      let n = cross(sub(b, a), sub(d, a));
      const len = Math.hypot(...n);
      if (len < 1e-7) continue;
      n = n.map((v) => v / len);
      const mid = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3];
      const flip = dot(n, sub(mid, c)) < 0;
      const tri = flip ? [a, d, b] : [a, b, d];
      if (flip) n = n.map((v) => -v);
      for (const p of tri) { bin.pos.push(...p); bin.nor.push(...n); }
    }
  }

  // ---- primitives; (x, y, z) is the centre of the base -------------------------------------------------------------
  box(color, x, y, z, w, h, d, o = {}) { this.frus(color, x, y, z, w, d, w, d, h, o); }

  // a rectangle at the bottom (w0 x d0) lofted to a rectangle at the top (w1 x d1); w1 = d1 = 0 makes a pyramid
  frus(color, x, y, z, w0, d0, w1, d1, h, o = {}) {
    this.at({ x, y, z, ...o }, () => {
      const b = [[-w0 / 2, 0, -d0 / 2], [w0 / 2, 0, -d0 / 2], [w0 / 2, 0, d0 / 2], [-w0 / 2, 0, d0 / 2]];
      const t = [[-w1 / 2, h, -d1 / 2], [w1 / 2, h, -d1 / 2], [w1 / 2, h, d1 / 2], [-w1 / 2, h, d1 / 2]];
      const tris = [[b[0], b[1], b[2]], [b[0], b[2], b[3]], [t[0], t[2], t[1]], [t[0], t[3], t[2]]];
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; tris.push([b[i], b[j], t[j]], [b[i], t[j], t[i]]); }
      this.emit(color, tris, [0, h / 2, 0]);
    });
  }

  // a round (or n-sided) column, tapering from r0 at the bottom to r1 at the top; r1 = 0 makes a cone
  cyl(color, x, y, z, r0, r1, h, seg = 16, o = {}) {
    this.at({ x, y, z, ...o }, () => {
      const ring = (r, yy) => Array.from({ length: seg }, (_, i) => [r * Math.cos((i / seg) * Math.PI * 2), yy, r * Math.sin((i / seg) * Math.PI * 2)]);
      const b = ring(r0, 0); const t = ring(r1, h); const tris = [];
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        tris.push([[0, 0, 0], b[i], b[j]], [b[i], b[j], t[j]], [b[i], t[j], t[i]]);
        if (r1 > 0) tris.push([[0, h, 0], t[i], t[j]]);
      }
      this.emit(color, tris, [0, h / 2, 0]);
    });
  }

  // the upper half of an ellipsoid, flat underneath (domes). rx/rz radius across, ry height.
  dome(color, x, y, z, r, hgt = r, seg = 18, o = {}) {
    this.at({ x, y, z, ...o }, () => {
      const rings = 8; const tris = []; const P = (k, i) => { const a = (k / rings) * (Math.PI / 2); const th = (i / seg) * Math.PI * 2; return [r * Math.cos(a) * Math.cos(th), hgt * Math.sin(a), r * Math.cos(a) * Math.sin(th)]; };
      for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; tris.push([P(k, i), P(k, j), P(k + 1, j)], [P(k, i), P(k + 1, j), P(k + 1, i)]); }
      for (let i = 0; i < seg; i++) tris.push([[0, 0, 0], P(0, i), P(0, (i + 1) % seg)]);
      this.emit(color, tris, [0, hgt * 0.35, 0]);
    });
  }

  // a full ball / egg
  ball(color, x, y, z, r, hgt = r, seg = 16, o = {}) {
    this.at({ x, y, z, ...o }, () => {
      const rings = 10; const tris = []; const P = (k, i) => { const a = (k / rings) * Math.PI - Math.PI / 2; const th = (i / seg) * Math.PI * 2; return [r * Math.cos(a) * Math.cos(th), hgt * (Math.sin(a) + 1) / 2 * 1, r * Math.cos(a) * Math.sin(th)]; };
      for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; tris.push([P(k, i), P(k, j), P(k + 1, j)], [P(k, i), P(k + 1, j), P(k + 1, i)]); }
      this.emit(color, tris, [0, hgt / 2, 0]);
    });
  }

  // ---- output --------------------------------------------------------------------------------------------------------
  // scale to a target height, stand on y = 0, centre on x/z, and write the file
  glb(targetHeight = 4) {
    let min = [Infinity, Infinity, Infinity]; let max = [-Infinity, -Infinity, -Infinity];
    for (const b of this.bins.values()) for (let i = 0; i < b.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.pos[i + k]); max[k] = Math.max(max[k], b.pos[i + k]); }
    const k = targetHeight / (max[1] - min[1]); const cx = (min[0] + max[0]) / 2; const cz = (min[2] + max[2]) / 2;
    const prims = []; const chunks = []; let off = 0; const views = []; const accessors = []; const materials = [];
    const push = (arr, target) => { const buf = Buffer.from(new Float32Array(arr).buffer); views.push({ buffer: 0, byteOffset: off, byteLength: buf.length, target }); chunks.push(buf); off += buf.length; return views.length - 1; };
    for (const b of this.bins.values()) {
      const pos = []; for (let i = 0; i < b.pos.length; i += 3) pos.push((b.pos[i] - cx) * k, (b.pos[i + 1] - min[1]) * k, (b.pos[i + 2] - cz) * k);
      let lo = [Infinity, Infinity, Infinity]; let hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i += 3) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], pos[i + q]); hi[q] = Math.max(hi[q], pos[i + q]); }
      const pv = push(pos, 34962); const nv = push(b.nor, 34962);
      accessors.push({ bufferView: pv, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: lo, max: hi }, { bufferView: nv, componentType: 5126, count: pos.length / 3, type: 'VEC3' });
      materials.push({ pbrMetallicRoughness: { baseColorFactor: [...b.color, 1], metallicFactor: 0, roughnessFactor: 0.85 }, doubleSided: true });
      prims.push({ attributes: { POSITION: accessors.length - 2, NORMAL: accessors.length - 1 }, material: materials.length - 1, mode: 4 });
    }
    const bin = Buffer.concat(chunks);
    const json = { asset: { version: '2.0', generator: 'wrld3 landmark generator' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: this.name }], meshes: [{ name: this.name, primitives: prims }], materials, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }] };
    let j = Buffer.from(JSON.stringify(json)); while (j.length % 4) j = Buffer.concat([j, Buffer.from(' ')]);
    let bb = bin; while (bb.length % 4) bb = Buffer.concat([bb, Buffer.from([0])]);
    const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + bb.length, 8);
    const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write('JSON', 4);
    const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.write('BIN\0', 4);
    return Buffer.concat([head, jh, j, bh, bb]);
  }
}
