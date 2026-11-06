// Copies just the public advertiser page and its assets out of backend/public into ./public (the Vercel output).
// The organizer pages (dashboard, events, sponsors approval) are deliberately left out.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const from = new URL('../../backend/public/', import.meta.url);
const to = new URL('./public/', import.meta.url);
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const f of ['sponsor.html', 'sponsor.css', 'skin.css', 'sponsor.bundle.js', 'hero-globe.bundle.js', 'tour.js', 'logo.png', 'title-light.png', 'title-dark.png']) cpSync(new URL(f, from), new URL(f, to));
console.log('copied the advertiser page');
