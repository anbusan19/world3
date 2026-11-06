// node build.mjs [slug...]  ->  writes ../<slug>.glb
import { writeFileSync } from 'node:fs';
import { Scene } from './glb.js';
import { LANDMARKS } from './landmarks.js';
import { parseGlb } from '../../backend/src/glb.js';
const only = process.argv.slice(2);
for (const [slug, build] of Object.entries(LANDMARKS)) {
  if (only.length && !only.includes(slug)) continue;
  const s = new Scene(slug); build(s);
  const buf = s.glb(4);
  const info = parseGlb(buf); // the same check the dashboard runs on upload
  writeFileSync(new URL(`../${slug}.glb`, import.meta.url), buf);
  console.log(slug.padEnd(22), `${(buf.length / 1024).toFixed(0)} KB`.padStart(8), `${info.triangles} tris`.padStart(11), `${info.bbox.size.map((v) => v.toFixed(1)).join(' x ')} m`);
}
