import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULTS, defaultLabel } from './validate.js';

// Spots live in one JSON file (backend/data/spots.json) and uploaded files in data/models and data/images.
// Writes are queued and atomic (write a temp file, then rename), so a crash can never leave half a file.
// Model files are named by their content hash, so a URL never changes meaning and can be cached forever.

export class Store {
  #queue = Promise.resolve();

  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'spots.json');
    this.modelsDir = path.join(dir, 'models');
    this.imagesDir = path.join(dir, 'images');
    this.spots = [];
    this.counter = 0; // the highest id ever handed out: an id is never reused, even after its spot is deleted
  }

  async init(seed = []) {
    await mkdir(this.modelsDir, { recursive: true });
    await mkdir(this.imagesDir, { recursive: true });
    if (existsSync(this.file)) {
      const j = JSON.parse(await readFile(this.file, 'utf8'));
      this.spots = j.spots ?? [];
      this.counter = Math.max(Number(j.counter) || 0, ...this.spots.map((x) => parseInt(x.id, 10) || 0));
      return;
    }
    const now = new Date().toISOString();
    this.spots = seed.map((s, i) => ({
      ...DEFAULTS,
      ...s,
      id: String(i + 1).padStart(2, '0'),
      published: true,
      model: null,
      image: null,
      createdAt: now,
      updatedAt: now,
    }));
    this.counter = this.spots.length;
    await this.#save();
  }

  #save() {
    const data = JSON.stringify({ version: 2, counter: this.counter, spots: this.spots }, null, 2);
    this.#queue = this.#queue.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    return this.#queue;
  }

  list() {
    return this.spots;
  }

  get(id) {
    return this.spots.find((s) => s.id === id) ?? null;
  }

  #nextId() {
    const max = this.spots.reduce((m, s) => Math.max(m, parseInt(s.id, 10) || 0), this.counter);
    this.counter = max + 1;
    return String(this.counter).padStart(2, '0');
  }

  async create(value) {
    const now = new Date().toISOString();
    const spot = {
      ...DEFAULTS,
      ...value,
      label: value.label ?? defaultLabel(value.name),
      id: this.#nextId(),
      model: null,
      image: null,
      createdAt: now,
      updatedAt: now,
    };
    this.spots.push(spot);
    await this.#save();
    return spot;
  }

  async update(id, patch) {
    const spot = this.get(id);
    if (!spot) return null;
    Object.assign(spot, patch, { updatedAt: new Date().toISOString() });
    await this.#save();
    return spot;
  }

  async remove(id) {
    const spot = this.get(id);
    if (!spot) return false;
    this.spots = this.spots.filter((s) => s.id !== id);
    await this.#save();
    await this.#deleteFile(spot.model?.file, this.modelsDir);
    await this.#deleteFile(spot.image?.file, this.imagesDir);
    return true;
  }

  async #deleteFile(name, dir) {
    if (name) await rm(path.join(dir, path.basename(name)), { force: true });
  }

  // kind: 'model' | 'image'. Replaces any earlier file for the spot and removes it from disk.
  async setFile(id, kind, info, bytes) {
    const spot = this.get(id);
    if (!spot) return null;
    const dir = kind === 'model' ? this.modelsDir : this.imagesDir;
    if (info) await writeFile(path.join(dir, info.file), bytes);
    const old = spot[kind]?.file;
    spot[kind] = info;
    spot.updatedAt = new Date().toISOString();
    await this.#save();
    if (old && old !== info?.file) await this.#deleteFile(old, dir);
    return spot;
  }
}

// What the phone app is allowed to see: published spots only, with file URLs the app can download.
export function toPublic(spot) {
  return {
    id: spot.id,
    name: spot.name,
    label: spot.label,
    city: spot.city,
    type: spot.type,
    kind: spot.kind,
    coord: [spot.lng, spot.lat],
    eventId: spot.eventId ?? 'ethmumbai',
    requires: spot.requires ?? null,
    captureRadiusM: spot.captureRadiusM,
    approachRadiusM: spot.approachRadiusM,
    theme: spot.theme,
    art: spot.art,
    icon: spot.icon,
    model: spot.model
      ? {
          url: `/files/models/${spot.model.file}`,
          bytes: spot.model.bytes,
          sha256: spot.model.sha256,
          sizeM: spot.model.stats?.bbox?.size ?? null, // the file's own size in metres, before scale
          scale: spot.scale,
          heading: spot.heading,
          heightOffsetM: spot.heightOffsetM,
        }
      : null,
    image: spot.image ? { url: `/files/images/${spot.image.file}` } : null,
  };
}
