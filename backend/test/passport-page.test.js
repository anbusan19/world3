import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let dir, server, base;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'wrld3-passport-'));
  ({ server } = await createApp({ dataDir: dir, publicDir: path.join(here, '..', 'public') }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); });

test('the share link /p/<label> serves the public passport page', async () => {
  const r = await fetch(`${base}/p/a7k2`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(await r.text(), /wrld3 passport/);
  assert.equal((await fetch(`${base}/p/a7k2/`)).status, 200);
  assert.equal((await fetch(`${base}/passport.html`)).status, 200);
});

test('only plausible passport labels are served, never paths that escape the folder', async () => {
  for (const bad of ['/p/Bad_Name', '/p/', '/p/a%2F..%2F..%2Fetc', '/p/' + 'a'.repeat(33), '/p/a b']) {
    assert.equal((await fetch(base + bad)).status, 404, bad);
  }
});

test('the page ships a bundle that asks ENS from the browser, not a server route that returns stamps', async () => {
  assert.equal((await fetch(`${base}/passport.bundle.js`)).status, 200);
  assert.equal((await fetch(`${base}/api/v1/passport/a7k2`)).status, 404, 'the server must not serve stamps itself');
});
