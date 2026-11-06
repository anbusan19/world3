import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isAddress } from 'viem';

// The sponsor wallets the organizer has approved. Only campaigns owned by an approved wallet (or the organizer's own) are ever shown.
// Approvals take effect straight away, with no restart. Addresses from the ARKIV_SPONSORS env var count too.
export class Sponsors {
  #queue = Promise.resolve();

  constructor(dir, fromEnv = []) {
    this.file = path.join(dir, 'sponsors.json');
    this.items = []; // { address (lowercase), name, addedAt, auto? }
    this.open = false; // hackathon mode: any wallet that shows up is approved on the spot (up to openMax of them)
    this.openMax = 30;
    this.env = fromEnv.map((a) => a.toLowerCase());
  }

  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    if (existsSync(this.file)) {
      const j = JSON.parse(await readFile(this.file, 'utf8'));
      this.items = j.sponsors ?? [];
      this.open = !!j.open;
    }
  }

  #save() {
    const data = JSON.stringify({ version: 1, open: this.open, sponsors: this.items }, null, 2);
    this.#queue = this.#queue.then(async () => { const tmp = `${this.file}.tmp`; await writeFile(tmp, data); await rename(tmp, this.file); });
    return this.#queue;
  }

  addresses() { return [...new Set([...this.env, ...this.items.map((s) => s.address)])]; }
  isApproved(address) { return !!address && this.addresses().includes(String(address).toLowerCase()); }
  list() { return [...this.items.map((s) => ({ ...s, source: 'dashboard' })), ...this.env.filter((a) => !this.items.some((s) => s.address === a)).map((address) => ({ address, name: '', source: 'env' }))]; }

  isOpen() { return this.open; }
  async setOpen(flag) { this.open = !!flag; await this.#save(); return this.open; }
  // Open mode only: approve a wallet that just showed up. Capped, so the list (and the Arkiv reads for it) cannot grow without limit.
  async autoAdd(address, now = Date.now()) {
    if (!this.open || !isAddress(String(address ?? ''), { strict: false })) return false;
    if (this.isApproved(address)) return true;
    if (this.items.filter((s) => s.auto).length >= this.openMax) return false;
    this.items.push({ address: String(address).toLowerCase(), name: 'Self-approved (open mode)', addedAt: new Date(now).toISOString(), auto: true });
    await this.#save();
    return true;
  }

  async add(address, name, now = Date.now()) {
    if (!isAddress(String(address), { strict: false })) throw new Error('That is not a wallet address.');
    const a = String(address).toLowerCase();
    const label = String(name ?? '').trim().slice(0, 40);
    const existing = this.items.find((s) => s.address === a);
    if (existing) existing.name = label || existing.name;
    else this.items.push({ address: a, name: label, addedAt: new Date(now).toISOString() });
    await this.#save();
    return this.items.find((s) => s.address === a);
  }

  async remove(address) {
    const a = String(address).toLowerCase();
    const before = this.items.length;
    this.items = this.items.filter((s) => s.address !== a);
    if (this.items.length !== before) await this.#save();
    return this.items.length !== before;
  }
}
