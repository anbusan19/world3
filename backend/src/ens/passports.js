import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Public passports, opt-in. A person asks for one; the server then, in the background (it takes about a minute and several
// transactions), gives them a name like k7m2qx.wrld3.eth with its own resolver, and publishes their stamps as one ENS text record.
// Until they ask, nothing about their captures is public. They can make it private again (the record is cleared) at any time.
//
// Honest limit: for now the backend holds the name's owner key (derived per person from a server secret), because the app has no wallet yet.
// Every step is saved as it finishes, so a failure part-way resumes instead of starting over or leaving duplicates.

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alike characters
const MIN_GAS = 4_000_000_000_000_000n; // 0.004 Sepolia ETH is the least a full passport needs, with room to spare
// our own messages are written for people and shown as they are; anything from a library or the network is reduced to a short, scrubbed line
export class PassportError extends Error {}
const safe = (e) => String(e instanceof PassportError ? e.message : (e?.shortMessage ?? e?.name ?? 'The passport could not be created')).replace(/https?:\/\/\S+/g, '[url]').replace(/ark_live_\S+/g, '[key]').slice(0, 140);

// What a chosen name may look like. Plain lowercase letters, digits and single dashes only (anything else would need ENS normalisation and
// invites look-alike characters), 3 to 20 long. A short list of names nobody may take: brands we do not own, and names that sound official.
export const LABEL_RULE = /^[a-z0-9](?:[a-z0-9]|-(?!-)){1,18}[a-z0-9]$/;
const RESERVED = new Set(['world', 'worldcoin', 'worldid', 'world3', 'wrld3', 'wrld', 'admin', 'administrator', 'root', 'support', 'official', 'staff', 'team', 'help', 'security', 'ens', 'eth', 'ethereum', 'ethglobal', 'arkiv', 'test', 'null', 'undefined', 'www', 'api', 'passport', 'sponsor', 'sponsors']);
export function checkLabel(raw) {
  const label = String(raw ?? '').trim().toLowerCase().replace(/\.wrld3\.eth$/, '');
  if (label.length < 3) return { ok: false, reason: 'Use at least 3 characters.' };
  if (label.length > 20) return { ok: false, reason: 'Use at most 20 characters.' };
  if (!LABEL_RULE.test(label)) return { ok: false, reason: 'Use only lowercase letters, numbers and single dashes, starting and ending with a letter or number.' };
  if (RESERVED.has(label) || label.startsWith('xn')) return { ok: false, reason: 'That name is reserved. Please pick another.' };
  return { ok: true, label };
}

export async function createPassports({ dataDir, ens, ownerSeed, captures, publicBase = '', random = Math.random, now = () => Date.now() }) {
  const file = path.join(dataDir, 'passports.json');
  await mkdir(dataDir, { recursive: true });
  const users = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).users ?? {} : {};
  let saving = Promise.resolve();
  const save = () => {
    const data = JSON.stringify({ version: 1, users }, null, 2);
    saving = saving.then(async () => { const tmp = `${file}.tmp`; await writeFile(tmp, data); await rename(tmp, file); });
    return saving;
  };
  // one writer at a time: every on-chain action uses the same wallet
  let tail = Promise.resolve();
  const enqueue = (fn) => { const run = tail.then(fn, fn); tail = run.catch(() => {}); return run; };

  const ownerFor = (userId) => privateKeyToAccount(keccak256(stringToBytes(`${ownerSeed}:${userId}`))).address;
  const stampsFor = (userId) => [...new Set(captures.items.filter((c) => c.userId === userId).map((c) => c.spotId))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)).join(',');
  const touch = (st) => { st.updatedAt = new Date(now()).toISOString(); };

  const dto = (userId) => {
    const st = users[userId];
    if (!st) return { status: 'none' };
    return {
      status: st.status,
      ...(st.label ? { label: st.label, name: st.name, path: `/p/${st.label}`, url: publicBase ? `${publicBase.replace(/\/+$/, '')}/p/${st.label}` : null } : {}),
      published: !!st.published,
      stamps: st.written ? st.written.split(',').filter(Boolean).length : 0,
      ...(st.status === 'error' ? { error: st.error } : {}),
    };
  };

  async function pickLabel() {
    for (let i = 0; i < 8; i++) {
      const label = Array.from({ length: 6 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
      if (await ens.isLabelFree(label)) return label;
    }
    throw new PassportError('Could not find a free passport name. Try again.');
  }

  async function publish(st, value) {
    if (value === (st.written ?? '')) return;
    await ens.setStamps({ name: st.name, resolver: st.resolver, value });
    st.written = value;
    touch(st); await save();
  }

  async function build(userId) {
    const st = users[userId];
    try {
      if (!st.resolver && (await ens.balance()) < MIN_GAS) throw new PassportError('The passport service is out of gas right now. Try again later.');
      st.owner ??= ownerFor(userId);
      if (!st.label) { st.label = await pickLabel(); st.name = `${st.label}.${ens.parent}`; await save(); }
      if (!st.resolver) { st.resolver = await ens.deployResolver(st.owner); await save(); }
      if (!st.restricted) { await ens.restrictBackend(st.resolver); st.restricted = true; await save(); }
      if (!st.named) {
        // the label is random and ours, so "not free" after a crash means the name was registered before we could save it
        if (await ens.isLabelFree(st.label)) await ens.registerName({ label: st.label, owner: st.owner, resolver: st.resolver });
        st.named = true; await save();
      }
      st.published = true; // asking for a passport is the consent to publish
      st.status = 'ready'; delete st.error; touch(st); await save();
      await publish(st, stampsFor(userId));
    } catch (e) {
      if (st.status !== 'ready') { st.status = 'error'; st.error = safe(e); } else st.syncError = safe(e);
      touch(st); await save();
    }
  }

  return {
    get: (userId) => dto(userId),

    // is this name allowed and free? (used while the person types)
    async available(raw) {
      const c = checkLabel(raw);
      if (!c.ok) return c;
      return (await ens.isLabelFree(c.label)) ? { ok: true, label: c.label } : { ok: false, reason: 'That name is taken.' };
    },

    // idempotent: asking twice never makes two passports. `label` is optional: a name the person chose (checked here), else a random one.
    // A retry after a failure keeps the name already chosen, so progress is never thrown away.
    async start(userId, label) {
      const st = users[userId];
      if (st?.status === 'ready' || st?.status === 'creating') return dto(userId);
      let chosen = null;
      if (label != null && label !== '' && !st?.label) {
        const a = await this.available(label);
        if (!a.ok) throw new PassportError(a.reason);
        chosen = a.label;
      }
      users[userId] = { ...(st ?? {}), ...(chosen ? { label: chosen, name: `${chosen}.${ens.parent}` } : {}), status: 'creating', createdAt: st?.createdAt ?? new Date(now()).toISOString() };
      delete users[userId].error;
      touch(users[userId]);
      save();
      enqueue(() => build(userId));
      return dto(userId);
    },

    // after a verified capture: keep the published record up to date (only for people who opted in and are public)
    onCapture(userId) {
      const st = users[userId];
      if (st?.status !== 'ready' || !st.published) return;
      enqueue(async () => { try { await publish(st, stampsFor(userId)); delete st.syncError; } catch (e) { st.syncError = safe(e); touch(st); await save(); } });
    },

    // make it private again (the record is cleared) or public again (stamps are written)
    setPublic(userId, flag) {
      const st = users[userId];
      if (st?.status !== 'ready') return null;
      st.published = !!flag; touch(st); save();
      enqueue(async () => { try { await publish(st, st.published ? stampsFor(userId) : ''); delete st.syncError; } catch (e) { st.syncError = safe(e); touch(st); await save(); } });
      return dto(userId);
    },

    idle: () => tail.then(() => saving),
    ownerFor,
  };
}
