import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Accounts, createAuthService } from '../src/auth.js';

test('a recovery code signs the same person back in without a new World ID proof, and a new code cancels the old one', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wrld3-rec-'));
  const accounts = new Accounts(dir); await accounts.init();
  const auth = createAuthService({ world: {}, accounts, now: () => 1000 });
  const first = await accounts.signIn('12345', 1000);
  const user = auth.user(first.token);
  const code = await auth.recoveryCode(user);
  assert.match(code, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
  // the same person, a new session, the same account
  const back = await auth.restore(code.toLowerCase().replaceAll('-', ' '));
  assert.equal(back.user.id, first.user.id);
  assert.equal(auth.user(back.token).id, user.id);
  // wrong codes do nothing
  assert.equal(await auth.restore('AAAA-AAAA-AAAA-AAAA-AAAA'), null);
  assert.equal(await auth.restore('short'), null);
  // a new code replaces the old one; the file holds only a hash
  const next = await auth.recoveryCode(user);
  assert.notEqual(next, code);
  assert.equal(await auth.restore(code), null);
  assert.equal((await auth.restore(next)).user.id, user.id);
  const again = new Accounts(dir); await again.init(); // survives a restart
  assert.equal((await again.restore(next, 1000)).user.id, user.id);
  const raw = JSON.stringify(again.users);
  assert.equal(raw.includes(next.replaceAll('-', '')), false);
  await rm(dir, { recursive: true, force: true });
});
