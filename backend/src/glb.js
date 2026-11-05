import { createHash } from 'node:crypto';

// Reads a binary glTF (.glb) and reports what matters for placing it in the world: its real size in metres, how heavy
// it is, and whether it is compressed. It never executes anything from the file, it only parses the JSON header.

export class GlbError extends Error {}

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

export const LIMITS = {
  maxBytes: 30 * 1024 * 1024, // refuse anything bigger
  warnBytes: 5 * 1024 * 1024, // the README targets roughly 2-5 MB per model
  warnTriangles: 150_000,
};

// ---- tiny column-major 4x4 matrix helpers (just enough to size a scene) -------------------------------------------
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function fromTRS(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

function trianglesOf(prim, accessors) {
  const mode = prim.mode ?? 4;
  const count = prim.indices != null ? accessors[prim.indices]?.count : accessors[prim.attributes?.POSITION]?.count;
  if (!count) return 0;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0; // points and lines are not triangles
}

export function parseGlb(buf) {
  if (!Buffer.isBuffer(buf)) throw new GlbError('Expected the raw file contents.');
  if (buf.length < 20) throw new GlbError('That file is too small to be a .glb.');
  if (buf.length > LIMITS.maxBytes) throw new GlbError(`That file is ${(buf.length / 1048576).toFixed(1)} MB. The limit is ${LIMITS.maxBytes / 1048576} MB.`);
  if (buf.readUInt32LE(0) !== MAGIC) throw new GlbError('That is not a .glb file (no glTF header). If you have a .gltf, export it as a single binary .glb.');
  if (buf.readUInt32LE(4) !== 2) throw new GlbError('Only glTF 2.0 is supported.');
  if (buf.readUInt32LE(8) !== buf.length) throw new GlbError('The file looks truncated or has extra data after the end.');

  let json = null;
  for (let off = 12; off + 8 <= buf.length; ) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const start = off + 8;
    const end = start + len;
    if (end > buf.length) throw new GlbError('A data chunk runs past the end of the file.');
    if (type === CHUNK_JSON && json === null) {
      try {
        json = JSON.parse(buf.toString('utf8', start, end));
      } catch {
        throw new GlbError('The model description inside the file is corrupt.');
      }
    }
    off = end;
  }
  if (!json) throw new GlbError('No model description found inside the file.');

  const accessors = json.accessors ?? [];
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const warnings = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  let missingBounds = false;

  const seen = new Set();
  const visit = (index, parent) => {
    if (seen.has(index) || !nodes[index]) return; // guards against cycles in a hostile file
    seen.add(index);
    const n = nodes[index];
    const local = n.matrix ? n.matrix : fromTRS(n.translation, n.rotation, n.scale);
    const world = multiply(parent, local);
    if (n.mesh != null && meshes[n.mesh]) {
      for (const prim of meshes[n.mesh].primitives ?? []) {
        triangles += trianglesOf(prim, accessors);
        const acc = accessors[prim.attributes?.POSITION];
        if (!acc?.min || !acc?.max) {
          missingBounds = true;
          continue;
        }
        for (let i = 0; i < 8; i++) {
          const p = apply(world, [i & 1 ? acc.max[0] : acc.min[0], i & 2 ? acc.max[1] : acc.min[1], i & 4 ? acc.max[2] : acc.min[2]]);
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[k]);
            max[k] = Math.max(max[k], p[k]);
          }
        }
      }
    }
    for (const child of n.children ?? []) visit(child, world);
    seen.delete(index);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  for (const root of scene?.nodes ?? nodes.map((_, i) => i)) visit(root, identity());

  const hasBounds = Number.isFinite(min[0]);
  const size = hasBounds ? max.map((v, k) => +(v - min[k]).toFixed(4)) : null;
  const used = json.extensionsUsed ?? [];
  const compressed = used.includes('KHR_draco_mesh_compression') || used.includes('EXT_meshopt_compression');

  if (buf.length > LIMITS.warnBytes) warnings.push(`This file is ${(buf.length / 1048576).toFixed(1)} MB. Aim for roughly 2-5 MB so it loads quickly on a phone.`);
  if (triangles > LIMITS.warnTriangles) warnings.push(`${triangles.toLocaleString('en-US')} triangles is heavy for a phone. Try under ${LIMITS.warnTriangles.toLocaleString('en-US')}.`);
  if (!compressed && buf.length > 2 * 1048576) warnings.push('The geometry is not compressed. Draco or meshopt compression usually makes a model several times smaller.');
  if (!hasBounds || missingBounds) warnings.push('Could not work out the real size of the model, so check the scale by eye.');
  if (size) {
    const biggest = Math.max(...size);
    if (biggest > 60) warnings.push(`The model is ${biggest.toFixed(1)} m across. If it was exported in centimetres or millimetres, shrink it in your 3D tool or use the Scale field.`);
    if (biggest < 0.05) warnings.push(`The model is only ${(biggest * 100).toFixed(1)} cm across. It may have been exported in metres by mistake, so check the Scale field.`);
    if (hasBounds && (min[1] < -0.5 || min[1] > 0.5)) warnings.push('The bottom of the model is not at ground level (Y = 0), so it may float or sink. Use the Height offset field to fix it.');
  }
  if ((json.animations ?? []).length) warnings.push('This model has animations. Only a still pose is shown for now.');

  return {
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    generator: json.asset?.generator ?? null,
    meshes: meshes.length,
    triangles,
    materials: (json.materials ?? []).length,
    textures: (json.textures ?? []).length,
    animations: (json.animations ?? []).length,
    compressed,
    extensionsUsed: used,
    bbox: hasBounds ? { min: min.map((v) => +v.toFixed(4)), max: max.map((v) => +v.toFixed(4)), size } : null,
    warnings,
  };
}
