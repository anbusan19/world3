import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CaptureError, refusal } from './world.js';

// Sign in with World ID. A person proves they are a unique human once; the proof's nullifier (the same for the same
// person and this app's "signin" action, and meaningless to anyone else) becomes their account. Signing in again, on
// this or another phone, finds the same account. The app then holds a random session token; we only keep its hash.

const DAY = 86_400_000;
const SESSION_DAYS = 30;
const sha = (s) => createHash('sha256').update(s).digest('hex');

export class Accounts {
  #queue = Promise.resolve();

  constructor(dir) {
    this.file = path.join(dir, 'accounts.json');
    this.users = []; // { id, signin: nullifier, capture: nullifier|null, createdAt }
    this.sessions = []; // { hash, userId, expiresAt }
  }

  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    if (existsSync(this.file)) {
      const d = JSON.parse(await readFile(this.file, 'utf8'));
      this.users = d.users ?? [];
      this.sessions = d.sessions ?? [];
    }
  }

  #save() {
    const data = JSON.stringify({ version: 1, users: this.users, sessions: this.sessions }, null, 2);
    this.#queue = this.#queue.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    return this.#queue;
  }

  async signIn(nullifier, now) {
    let user = this.users.find((u) => u.signin === nullifier);
    if (!user) {
      user = { id: `u_${sha(nullifier).slice(0, 16)}`, signin: nullifier, capture: null, createdAt: new Date(now).toISOString() };
      this.users.push(user);
    }
    const token = randomBytes(32).toString('base64url');
    this.sessions = this.sessions.filter((s) => s.expiresAt > now);
    this.sessions.push({ hash: sha(token), userId: user.id, expiresAt: now + SESSION_DAYS * DAY });
    await this.#save();
    return { token, user: { id: user.id } };
  }

  userFor(token, now) {
    if (!token) return null;
    const h = sha(token);
    const s = this.sessions.find((x) => x.hash === h && x.expiresAt > now);
    return s ? this.users.find((u) => u.id === s.userId) ?? null : null;
  }

  async signOut(token) {
    const h = sha(token ?? '');
    this.sessions = this.sessions.filter((s) => s.hash !== h);
    await this.#save();
  }

  // the first capture ties this account to one human's capture nullifier; later captures must be the same human
  async bindCapture(user, nullifier) {
    if (user.capture === null) { user.capture = nullifier; await this.#save(); return true; }
    return user.capture === nullifier;
  }
}

// `action` is the World ID action people sign in with. A person can prove only once per action, so changing it starts
// everyone over (useful in testing; real re-login needs session proofs, which are not built yet).
export function createAuthService({ world, accounts, action = 'signin', now = () => Date.now() }) {
  const ACTION = action;
  return {
    action: ACTION,
    request: () => world.sign(ACTION, {}),
    async verify({ nonce, idkitResponse }) {
      if (world.take(nonce, ACTION) === null) throw refusal('nonce');
      const nullifier = await world.verifyProof(idkitResponse, nonce, ACTION);
      return accounts.signIn(nullifier, now());
    },
    user(token) {
      return accounts.userFor(token, now());
    },
    signOut: (token) => accounts.signOut(token),
  };
}

export { CaptureError };
