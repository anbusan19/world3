import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The events the app runs. A spot belongs to one event (spot.eventId, default 'ethmumbai'), and lives only while its event is
// live: before the start it is hidden, after the end it can no longer be captured and its ads stop, but a stamp someone
// already collected stays in their passport as a memory. The first event ('ethmumbai') always exists.
export const MAIN = 'ethmumbai';
const SLUG = /^[a-z0-9][a-z0-9-]{1,23}$/;
const iso = (v, label) => {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new Error(`${label} is not a valid date and time.`);
  return new Date(t).toISOString();
};

export class Events {
  #queue = Promise.resolve();

  constructor(dir, { endsAt = null } = {}) {
    this.dir = dir;
    this.file = path.join(dir, 'events.json');
    this.items = [{ id: MAIN, name: 'ETHGlobal Mumbai', blurb: '', startsAt: null, endsAt, theme: 'sky' }];
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
    if (existsSync(this.file)) {
      this.items = JSON.parse(await readFile(this.file, 'utf8')).events ?? this.items;
    } else {
      const old = path.join(this.dir, 'event.json'); // the single-event file of earlier versions
      if (existsSync(old)) { const j = JSON.parse(await readFile(old, 'utf8')); this.items[0].name = j.name ?? this.items[0].name; this.items[0].endsAt = j.endsAt ?? this.items[0].endsAt; }
      await this.#save();
    }
    if (!this.items.some((e) => e.id === MAIN)) this.items.unshift({ id: MAIN, name: 'ETHGlobal Mumbai', blurb: '', startsAt: null, endsAt: null, theme: 'sky' });
  }

  #save() {
    const data = JSON.stringify({ version: 2, events: this.items }, null, 2);
    this.#queue = this.#queue.then(async () => { const tmp = `${this.file}.tmp`; await writeFile(tmp, data); await rename(tmp, this.file); });
    return this.#queue;
  }

  get main() { return this.get(MAIN); }
  get name() { return this.main.name; }
  get(id) { return this.items.find((e) => e.id === id) ?? null; }
  of(spot) { return this.get(spot?.eventId ?? MAIN) ?? this.main; }

  status(ev, now = Date.now()) {
    const s = ev.startsAt ? Date.parse(ev.startsAt) : null; const e = ev.endsAt ? Date.parse(ev.endsAt) : null;
    if (s != null && now < s) return 'upcoming';
    if (e != null && now >= e) return 'ended';
    return 'live';
  }
  over(now = Date.now()) { return this.status(this.main, now) === 'ended'; } // the main event (kept for the dashboard chip)
  live(spot, now = Date.now()) { return this.status(this.of(spot), now) === 'live'; }
  snapshot(ev = this.main, now = Date.now()) { return { id: ev.id, name: ev.name, blurb: ev.blurb ?? '', theme: ev.theme ?? 'sky', startsAt: ev.startsAt ?? null, endsAt: ev.endsAt ?? null, status: this.status(ev, now), over: this.status(ev, now) === 'ended' }; }
  list(now = Date.now()) { return this.items.map((e) => this.snapshot(e, now)); }

  async upsert(input) {
    const id = String(input.id ?? '').trim().toLowerCase();
    if (!SLUG.test(id)) throw new Error('An event id is 2 to 24 lowercase letters, numbers or dashes.');
    const name = String(input.name ?? '').trim();
    if (name.length < 2 || name.length > 60) throw new Error('Give the event a name between 2 and 60 characters.');
    const startsAt = iso(input.startsAt, 'The start'); const endsAt = iso(input.endsAt, 'The end');
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('The end must be after the start.');
    const rec = { id, name, blurb: String(input.blurb ?? '').trim().slice(0, 240), startsAt, endsAt, theme: ['coral', 'sky', 'sun', 'leaf', 'ocean'].includes(input.theme) ? input.theme : 'sky' };
    const i = this.items.findIndex((e) => e.id === id);
    if (i >= 0) this.items[i] = { ...this.items[i], ...rec }; else this.items.push(rec);
    await this.#save();
    return this.get(id);
  }

  async remove(id) {
    if (id === MAIN) throw new Error('The main event cannot be removed.');
    const before = this.items.length;
    this.items = this.items.filter((e) => e.id !== id);
    if (this.items.length !== before) await this.#save();
    return this.items.length !== before;
  }
}
