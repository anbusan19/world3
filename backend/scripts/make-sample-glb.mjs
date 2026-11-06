// Writes backend/samples/sample-arch.glb: a small stylised gateway arch built from boxes. Use it to try the dashboard
// without your own models. The file is generated here, so it is not a real landmark model.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildSampleGlb() {
  const colors = [
    [0.85, 0.6, 0.31, 1], // sandstone
    [0.72, 0.47, 0.23, 1], // darker stone
    [0.95, 0.42, 0.13, 1], // orange accent
  ];
  // [centre x, y, z], [size x, y, z], material. The base sits on Y = 0, like the dashboard expects.
  const boxes = [
    [[0, 0.25, 0], [8, 0.5, 4], 1],
    [[-2.6, 2.5, 0], [1.8, 4, 3], 0],
    [[2.6, 2.5, 0], [1.8, 4, 3], 0],
    [[0, 5.0, 0], [7.2, 1.2, 3], 0],
    [[0, 5.9, 0], [8, 0.4, 3.4], 2],
    [[-3.7, 6.6, 0], [0.9, 1.4, 0.9], 1],
    [[3.7, 6.6, 0], [0.9, 1.4, 0.9], 1],
  ];

  const faces = [
    { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  ];

  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const primitives = [];
  let offset = 0;
  const push = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    chunks.push(bytes);
    offset += bytes.length;
    return bufferViews.length - 1;
  };

  for (const [c, s, material] of boxes) {
    const pos = [], nor = [], idx = [];
    for (const f of faces) {
      const base = pos.length / 3;
      for (const v of f.v) {
        pos.push(c[0] + (v[0] * s[0]) / 2, c[1] + (v[1] * s[1]) / 2, c[2] + (v[2] * s[2]) / 2);
        nor.push(...f.n);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const positions = new Float32Array(pos);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], positions[i + k]); mx[k] = Math.max(mx[k], positions[i + k]); }
    const vPos = push(positions, 34962);
    const vNor = push(new Float32Array(nor), 34962);
    const vIdx = push(new Uint16Array(idx), 34963);
    accessors.push({ bufferView: vPos, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: mn, max: mx });
    accessors.push({ bufferView: vNor, componentType: 5126, count: nor.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: vIdx, componentType: 5123, count: idx.length, type: 'SCALAR' });
    const a = accessors.length;
    primitives.push({ attributes: { POSITION: a - 3, NORMAL: a - 2 }, indices: a - 1, material });
    // keep every view 4-byte aligned
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  }

  const json = {
    asset: { version: '2.0', generator: 'wrld3 sample generator' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'arch' }],
    meshes: [{ primitives }],
    materials: colors.map((baseColorFactor, i) => ({ name: `stone-${i}`, pbrMetallicRoughness: { baseColorFactor, metallicFactor: 0, roughnessFactor: 0.85 } })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };

  const bin = Buffer.concat(chunks);
  let jsonBuf = Buffer.from(JSON.stringify(json));
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPad.length, 8);
  const chunkHead = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([header, chunkHead(jsonBuf.length, 0x4e4f534a), jsonBuf, chunkHead(binPad.length, 0x004e4942), binPad]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, '..', 'samples', 'sample-arch.glb');
  mkdirSync(dirname(out), { recursive: true });
  const glb = buildSampleGlb();
  writeFileSync(out, glb);
  console.log(`wrote ${out} (${glb.length} bytes)`);
}
