// Makes a new spot that sits at an existing spot's place and uses another spot's 3D model. Runs against the dashboard's own API on the
// computer that runs the server (nothing is edited by hand, so Arkiv and the Stamp contract are kept in step like any other spot).
//
//   node scripts/clone-spot.mjs --from 83 --model-from 02 --name "World Pitch" --label PITCH
//
//   --from <id>         the spot whose place and settings are copied (coordinates, radii, event, colours)
//   --model-from <id>   the spot whose 3D model (and its scale and heading) is used
//   --name, --label     the new spot's name and stamp label
//   --publish           publish it right away (default: leave it as a draft you publish in the dashboard)
//   --api <url>         the dashboard API (default http://127.0.0.1:3000)
//   --data <dir>        the server's data folder, where the model files are (default ../data)
//   --dry-run           print what would be created and change nothing
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const COPY = ['city', 'type', 'kind', 'lat', 'lng', 'captureRadiusM', 'approachRadiusM', 'theme', 'art', 'icon', 'eventId', 'requires'];

export async function cloneSpot({ api = 'http://127.0.0.1:3000', dataDir, from, modelFrom, name, label, publish = false, dryRun = false, fetchImpl = fetch }) {
  const call = async (method, p, body, headers = {}) => {
    const res = await fetchImpl(`${api}${p}`, { method, headers: { 'x-requested-with': 'wrld3-dashboard', ...(body && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...headers }, body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${out.error ?? out.message ?? ''} ${JSON.stringify(out.issues ?? '')}`.trim());
    return out;
  };
  const { spots } = await call('GET', '/api/spots');
  const pad = (id) => String(id).padStart(2, '0');
  const src = spots.find((s) => s.id === pad(from));
  const mod = spots.find((s) => s.id === pad(modelFrom));
  if (!src) throw new Error(`No spot ${from}.`);
  if (!mod) throw new Error(`No spot ${modelFrom}.`);
  if (!mod.model?.file) throw new Error(`Spot ${modelFrom} has no 3D model.`);

  const payload = { name, label: label ?? undefined, published: false };
  for (const k of COPY) if (src[k] !== undefined && src[k] !== null) payload[k] = src[k];
  for (const k of ['scale', 'heading', 'heightOffsetM']) if (mod[k] !== undefined) payload[k] = mod[k]; // the model's own tuning
  if (dryRun) return { dryRun: true, payload, model: mod.model.file };

  const file = path.join(dataDir, 'models', mod.model.file);
  const glb = new Uint8Array(await readFile(file));
  const { spot } = await call('POST', '/api/spots', payload);
  await call('PUT', `/api/spots/${spot.id}/model`, glb, { 'content-type': 'model/gltf-binary', 'x-filename': `${name.replace(/[^A-Za-z0-9._-]+/g, '-')}.glb` });
  if (publish) await call('PUT', `/api/spots/${spot.id}`, { published: true });
  const { spot: done } = await call('GET', `/api/spots/${spot.id}`);
  return { id: done.id, published: !!done.published, model: done.model?.file ?? null, lat: done.lat, lng: done.lng };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values: a } = parseArgs({ options: { from: { type: 'string' }, 'model-from': { type: 'string' }, name: { type: 'string' }, label: { type: 'string' }, publish: { type: 'boolean' }, api: { type: 'string' }, data: { type: 'string' }, 'dry-run': { type: 'boolean' } } });
  if (!a.from || !a['model-from'] || !a.name) { console.error('Usage: node scripts/clone-spot.mjs --from 83 --model-from 02 --name "World Pitch" --label PITCH [--publish] [--dry-run]'); process.exit(1); }
  const here = path.dirname(fileURLToPath(import.meta.url));
  try {
    const out = await cloneSpot({ api: a.api, dataDir: a.data ?? path.join(here, '..', 'data'), from: a.from, modelFrom: a['model-from'], name: a.name, label: a.label, publish: !!a.publish, dryRun: !!a['dry-run'] });
    console.log(JSON.stringify(out, null, 2));
    if (!out.dryRun) console.log(`\nCreated spot ${out.id}${out.published ? ' and published it' : ' as a draft. Publish it in the dashboard.'} The World ID action for it is capture-${out.id}; check that it exists in the World developer portal.`);
  } catch (e) { console.error(`\n  ${e.message}\n`); process.exit(1); }
}
