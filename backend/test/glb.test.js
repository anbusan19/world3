import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSampleGlb } from '../scripts/make-sample-glb.mjs';
import { GlbError, parseGlb } from '../src/glb.js';

test('reads the size, triangle count and hash of a real model', () => {
  const r = parseGlb(buildSampleGlb());
  assert.equal(r.meshes, 1);
  assert.equal(r.triangles, 84); // 7 boxes x 12 triangles
  assert.equal(r.compressed, false);
  assert.deepEqual(r.bbox.size, [8.3, 7.3, 4]);
  assert.equal(r.bbox.min[1], 0); // sits on the ground
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(r.warnings, []);
});

test('rejects files that are not .glb, with a message a person can act on', () => {
  assert.throws(() => parseGlb(Buffer.from('{"asset":{"version":"2.0"}}'.padEnd(40))), (e) => e instanceof GlbError && /not a \.glb/i.test(e.message));
  assert.throws(() => parseGlb(Buffer.alloc(4)), GlbError);
});

test('rejects a truncated file', () => {
  const glb = buildSampleGlb();
  assert.throws(() => parseGlb(glb.subarray(0, glb.length - 10)), (e) => e instanceof GlbError && /truncated/i.test(e.message));
});

test('warns about a model exported in the wrong units, and about floating models', () => {
  // scale the whole sample up 100x with a node transform, as a centimetres-to-metres export mistake would
  const glb = buildSampleGlb();
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));
  json.nodes[0].scale = [100, 100, 100];
  json.nodes[0].translation = [0, 3, 0];
  let jb = Buffer.from(JSON.stringify(json));
  jb = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  const rest = glb.subarray(20 + jsonLen);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jb.length + rest.length, 8);
  head.writeUInt32LE(jb.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  const r = parseGlb(Buffer.concat([head, jb, rest]));
  assert.ok(r.bbox.size[0] > 800);
  assert.ok(r.warnings.some((w) => /centimetres|metres across/.test(w)));
  assert.ok(r.warnings.some((w) => /ground level/.test(w)));
});

test('survives a hostile node loop instead of hanging', () => {
  const glb = buildSampleGlb();
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));
  json.nodes = [{ children: [1] }, { children: [0], mesh: 0 }];
  json.scenes = [{ nodes: [0] }];
  let jb = Buffer.from(JSON.stringify(json));
  jb = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  const rest = glb.subarray(20 + jsonLen);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jb.length + rest.length, 8);
  head.writeUInt32LE(jb.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  assert.doesNotThrow(() => parseGlb(Buffer.concat([head, jb, rest])));
});
