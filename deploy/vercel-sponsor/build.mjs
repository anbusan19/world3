// Copies just the public advertiser page and its assets out of backend/public into ./public (the Vercel output).
// The organizer pages (dashboard, events, sponsors approval) are deliberately left out.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
const from = new URL('../../backend/public/', import.meta.url);
const to = new URL('./public/', import.meta.url);
// Deployed from this folder alone (vercel CLI), the backend folder is not there: keep the pages that were built locally.
if (!existsSync(from) && existsSync(new URL('sponsor.html', to))) { console.log('using the pages already in ./public'); process.exit(0); }
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const f of ['sponsor.html', 'sponsor.css', 'skin.css', 'sponsor.bundle.js', 'hero-globe.bundle.js', 'tour.js', 'logo.png', 'title-light.png', 'title-dark.png']) cpSync(new URL(f, from), new URL(f, to));
console.log('copied the advertiser page');
