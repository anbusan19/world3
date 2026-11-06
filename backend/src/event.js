import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The event's clock. Spots, captures and ads all live only until the event ends: after that the app no longer gets
// the spots, nothing can be captured, and no ad is shown. The organizer can move the end time from the dashboard
// (or set EVENT_ENDS_AT). No end time means "no end".
export class EventClock {
  #queue = Promise.resolve();

  constructor(dir, { name = 'ETHGlobal Mumbai', endsAt = null } = {}) {
    this.file = path.join(dir, 'event.json');
    this.name = name;
    this.endsAt = endsAt; // ISO string or null
  }

  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    if (existsSync(this.file)) {
      const j = JSON.parse(await readFile(this.file, 'utf8'));
      this.name = j.name ?? this.name;
      this.endsAt = j.endsAt ?? null;
    } else if (this.endsAt) await this.#save();
  }

  #save() {
    const data = JSON.stringify({ version: 1, name: this.name, endsAt: this.endsAt }, null, 2);
    this.#queue = this.#queue.then(async () => { const tmp = `${this.file}.tmp`; await writeFile(tmp, data); await rename(tmp, this.file); });
    return this.#queue;
  }

  endMs() { return this.endsAt ? Date.parse(this.endsAt) : null; }
  over(now = Date.now()) { const e = this.endMs(); return e != null && now >= e; }
  snapshot(now = Date.now()) { return { name: this.name, endsAt: this.endsAt, over: this.over(now) }; }

  async set({ endsAt, name } = {}) {
    if (endsAt !== undefined) {
      if (endsAt !== null && Number.isNaN(Date.parse(endsAt))) throw new Error('That is not a valid date and time.');
      this.endsAt = endsAt === null ? null : new Date(endsAt).toISOString();
    }
    if (typeof name === 'string' && name.trim()) this.name = name.trim().slice(0, 60);
    await this.#save();
    return this.snapshot();
  }
}
