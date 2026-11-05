import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

// secrets live in backend/.env (git-ignored)
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env: World ID stays unconfigured */ }

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const dataDir = process.env.DATA_DIR ?? path.join(here, '..', 'data');
const publicDir = path.join(here, '..', 'public');

const { server, store } = await createApp({ dataDir, publicDir, host: HOST, log: (line) => console.log(line) });

server.listen(PORT, HOST, () => {
  const base = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log(`
  World3 spots server
  -------------------
  Dashboard   ${base}
  App feed    ${base}/api/v1/spots
  Data        ${dataDir}  (${store.list().length} spots)

  Phone over USB:  adb reverse tcp:${PORT} tcp:${PORT}
  ${HOST === '0.0.0.0' ? 'WARNING: listening on every network interface and there is NO login. Anyone on your network can edit spots.' : 'Listening on this computer only (there is no login yet).'}
`);
});
