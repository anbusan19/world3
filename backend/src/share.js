import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// Share cards: a 1200x630 picture (the size X shows for a link) and the small web page that carries it as Open Graph /
// Twitter Card tags, so pasting the page's link into X shows the picture. Cards only ever contain what is already public:
// a campaign's sponsor, headline and image, or a spot's name. No people, no coordinates.

const W = 1200;
const H = 630;
const dir = new URL('../assets/', import.meta.url);
const FONTS = ['PlusJakartaSans_500Medium', 'PlusJakartaSans_700Bold', 'PlusJakartaSans_800ExtraBold'].map((f) => new URL(`fonts/${f}.ttf`, dir).pathname);
const WORDMARK = `data:image/png;base64,${readFileSync(new URL('title-light.png', dir)).toString('base64')}`;
const FAMILY = 'Plus Jakarta Sans';
const THEMES = {
  coral: { frame: '#F9A98B', sky: '#FFE9D6', hill: '#F7C59F', hill2: '#F2A065', accent: '#D9481C' },
  sky: { frame: '#8FD3E4', sky: '#E6F7FB', hill: '#B7E4D3', hill2: '#6FBF9C', accent: '#0A6EA6' },
  sun: { frame: '#F4D35E', sky: '#FFF7D1', hill: '#F9D77E', hill2: '#EFA93A', accent: '#B45F06' },
  leaf: { frame: '#A6D16C', sky: '#EDF7DA', hill: '#8CC152', hill2: '#5F9E2F', accent: '#2F6B14' },
  ocean: { frame: '#3D8FD0', sky: '#D6EAF8', hill: '#7FB8E3', hill2: '#0265AD', accent: '#0B4F86' },
};

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// split text into at most `maxLines` lines of about `maxChars` characters, ending with an ellipsis if it does not fit
export function wrap(text, maxChars, maxLines) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '').slice(0, maxChars - 1) + '…'; return keep; }
  return lines;
}
const tspans = (lines, x, lineH) => lines.map((l, i) => `<tspan x="${x}" dy="${i ? lineH : 0}">${esc(l)}</tspan>`).join('');

const globe = (cx, cy, r) => `<g><clipPath id="gc"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0265AD"/>
<g clip-path="url(#gc)" fill="#A6D16C" transform="translate(${cx - r} ${cy - r}) scale(${r / 50})"><path d="M30 22C48 10 76 14 88 32 94 46 86 56 72 56 62 60 54 50 44 52 34 48 22 36 30 22Z"/><path d="M50 54C60 56 66 62 64 72 62 80 58 86 56 90 51 84 47 74 47 64 47 58 48 55 50 54Z"/><path d="M6 44C18 36 30 44 32 56 32 68 26 76 18 86 8 84 2 72 2 60Z"/><path d="M68 78C80 72 94 78 94 88 86 96 72 94 66 86Z"/></g></g>`;

const footer = (extra = '') => `<image href="${WORDMARK}" x="64" y="${H - 104}" width="150" height="49"/>
<text x="232" y="${H - 72}" font-family="${FAMILY}" font-weight="500" font-size="22" fill="#0B0B0F" opacity=".7">Go there. Prove it. Keep it.${esc(extra)}</text>`;

export function adCardSvg({ sponsor, headline, creative, mime, eventName = 'ETHGlobal Mumbai' }) {
  const name = wrap(sponsor, 22, 1)[0] ?? '';
  const head = wrap(headline, 34, 3);
  const pill = `NOW LIVE · ${eventName.toUpperCase().slice(0, 22)}`;
  const pillW = Math.round(pill.length * 14 + 44);
  const img = creative ? `<clipPath id="ci"><rect x="660" y="150" width="480" height="270" rx="28"/></clipPath>
    <rect x="652" y="142" width="496" height="286" rx="34" fill="#fff"/>
    <image href="data:${esc(mime)};base64,${creative.toString('base64')}" x="660" y="150" width="480" height="270" preserveAspectRatio="xMidYMid slice" clip-path="url(#ci)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#F5F1E4"/>
<rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="44" fill="#A6D16C"/>
${globe(1090, 560, 210)}
<rect x="64" y="64" width="${pillW}" height="44" rx="22" fill="#0B0B0F"/>
<text x="${64 + pillW / 2}" y="94" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="19" letter-spacing="2" fill="#A6D16C">${esc(pill)}</text>
<text x="64" y="204" font-family="${FAMILY}" font-weight="800" font-size="76" letter-spacing="-3" fill="#0B0B0F">We're live</text>
<text x="64" y="284" font-family="${FAMILY}" font-weight="800" font-size="76" letter-spacing="-3" fill="#0B0B0F">on WRLD³</text>
<text x="64" y="352" font-family="${FAMILY}" font-weight="800" font-size="38" letter-spacing="-1" fill="#0B0B0F">${esc(name)}</text>
<text x="64" y="398" font-family="${FAMILY}" font-weight="500" font-size="26" fill="#1D2A0A">${tspans(head, 64, 34)}</text>
${img}
${footer()}
</svg>`;
}

// the app's perforated stamp outline, as an SVG path (notches cut into every edge)
function perforated(w, h, r) {
  const nx = Math.max(4, Math.round(w / (r * 4.2))); const ny = Math.max(4, Math.round(h / (r * 4.2)));
  const px = w / nx; const py = h / ny; let d = 'M0 0';
  for (let i = 0; i < nx; i++) { const cx = (i + 0.5) * px; d += ` L${cx - r} 0 A${r} ${r} 0 0 0 ${cx + r} 0`; }
  d += ` L${w} 0`;
  for (let j = 0; j < ny; j++) { const cy = (j + 0.5) * py; d += ` L${w} ${cy - r} A${r} ${r} 0 0 0 ${w} ${cy + r}`; }
  d += ` L${w} ${h}`;
  for (let i = nx - 1; i >= 0; i--) { const cx = (i + 0.5) * px; d += ` L${cx + r} ${h} A${r} ${r} 0 0 0 ${cx - r} ${h}`; }
  d += ` L0 ${h}`;
  for (let j = ny - 1; j >= 0; j--) { const cy = (j + 0.5) * py; d += ` L0 ${cy + r} A${r} ${r} 0 0 0 0 ${cy - r}`; }
  return `${d} Z`;
}

export function stampCardSvg({ spot, eventName = 'ETHGlobal Mumbai' }) {
  const t = THEMES[spot.theme] ?? THEMES.coral;
  const sw = 300; const sh = Math.round(sw / 0.82); const pad = 18;
  const name = wrap(spot.name, 16, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#F5F1E4"/>
<rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="44" fill="#0265AD"/>
${globe(1100, 70, 200)}
<g transform="translate(110 ${Math.round((H - sh) / 2) - 52}) rotate(-5 ${sw / 2} ${sh / 2})">
  <path d="${perforated(sw, sh, 9)}" fill="${t.frame}"/>
  <clipPath id="sc"><rect x="${pad}" y="${pad}" width="${sw - pad * 2}" height="${sh - pad * 2 - 44}" rx="6"/></clipPath>
  <g clip-path="url(#sc)"><rect x="${pad}" y="${pad}" width="${sw}" height="${sh}" fill="${t.sky}"/>
    <circle cx="${sw - 90}" cy="96" r="34" fill="#F26B21"/>
    <ellipse cx="90" cy="${sh - 70}" rx="190" ry="120" fill="${t.hill}"/><ellipse cx="${sw - 40}" cy="${sh - 40}" rx="210" ry="120" fill="${t.hill2}"/></g>
  <rect x="${pad}" y="${pad}" width="${sw - pad * 2}" height="${sh - pad * 2 - 44}" rx="6" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
  <text x="${sw / 2}" y="${sh - 26}" text-anchor="middle" font-family="${FAMILY}" font-weight="800" font-size="30" letter-spacing="3" fill="${t.accent}">${esc(String(spot.label ?? spot.name).toUpperCase().slice(0, 12))}</text>
</g>
<text x="500" y="164" font-family="${FAMILY}" font-weight="800" font-size="24" letter-spacing="3" fill="#A6D16C">STAMP COLLECTED</text>
<text x="500" y="250" font-family="${FAMILY}" font-weight="800" font-size="64" letter-spacing="-2.5" fill="#FFFFFF">${tspans(name, 500, 72)}</text>
<text x="500" y="${250 + 72 * name.length + 14}" font-family="${FAMILY}" font-weight="500" font-size="28" fill="#FFFFFF" opacity=".85">${esc(spot.city ?? '')} · ${esc(eventName)}</text>
<text x="500" y="${H - 150}" font-family="${FAMILY}" font-weight="700" font-size="30" fill="#FFFFFF">I was really there. Proved by World ID.</text>
<rect x="60" y="${H - 118}" width="196" height="64" rx="18" fill="#fff"/>
<image href="${WORDMARK}" x="72" y="${H - 112}" width="172" height="56"/>
<text x="284" y="${H - 78}" font-family="${FAMILY}" font-weight="500" font-size="22" fill="#fff" opacity=".85">Go there. Prove it. Keep it.</text>
</svg>`;
}

export function toPng(svg) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: FAMILY } }).render().asPng();
}

// the tiny page X's crawler reads (and a person lands on if they click the link)
export function sharePage({ title, description, image, url }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="${W}"><meta property="og:image:height" content="${H}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F5F1E4;font:500 16px/1.5 system-ui,sans-serif;color:#0B0B0F}main{max-width:640px;padding:24px;text-align:left}img{width:100%;border-radius:28px;display:block}h1{letter-spacing:-.03em;margin:18px 0 6px}p{margin:0;color:#4B4F59}</style>
</head><body><main><img src="${esc(image)}" alt="${esc(title)}" width="${W}" height="${H}"><h1>${esc(title)}</h1><p>${esc(description)}</p></main></body></html>`;
}

// The card is drawn by resvg, which can embed PNG and JPEG pictures but silently draws NOTHING for WebP (the white box on the card).
// The advertiser page shrinks every ad to WebP, so convert anything that is not PNG or JPEG to a PNG first. If the converter is not
// installed or the picture cannot be read, the card is still made, without the picture.
export async function renderableImage(buf, mime) {
  if (!buf || !buf.length) return { creative: null, mime };
  if (mime === 'image/png' || mime === 'image/jpeg') return { creative: buf, mime };
  try {
    const { default: sharp } = await import('sharp');
    return { creative: await sharp(buf, { animated: false }).png().toBuffer(), mime: 'image/png' };
  } catch {
    return { creative: null, mime };
  }
}
