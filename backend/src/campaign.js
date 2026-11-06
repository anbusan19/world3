import { createHash } from 'node:crypto';
import { bytes, defineSchema, i32, str, u64 } from '@arkiv-network/sdk/schema';

// A sponsor campaign is one Arkiv entity written and owned by the sponsor's OWN wallet. It carries the ad itself (a small
// image inside the entity, up to ~100 KB), so there is no second system to keep alive and it expires with the campaign.
// Everything here is public. Nothing about the people who see an ad is ever stored on Arkiv.

export const CAMPAIGN_SCHEMA_NAME = 'world3.campaign';
export const CampaignSchema = defineSchema(CAMPAIGN_SCHEMA_NAME, {
  eventSlug: str().indexed(),
  spotId: str().indexed(),
  status: str().indexed(), // 'active' | 'paused'
  startsAt: u64().indexed(), // unix seconds
  endsAt: u64().indexed(),
  sponsor: str(), // display name
  headline: str(),
  clickUrl: str(),
  alt: str(),
  mime: str(),
  sha256: str(), // 0x + hex digest of the creative bytes
  width: i32(),
  height: i32(),
  creative: bytes(),
});

export const LIMITS = { creativeBytes: 100 * 1024, maxSide: 1280, sponsor: 40, headline: 60, alt: 100, url: 120 };
const MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export class CampaignError extends Error {}
const bad = (m) => { throw new CampaignError(m); };

export const sha256Hex = (buf) => '0x' + createHash('sha256').update(buf).digest('hex');

// Reads the real type and size from the file's own bytes; the declared mime and size are never trusted.
export function inspectImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) bad('That file is too small to be an image.');
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 3) === 'GIF') return { mime: 'image/gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    bad('That JPEG has no readable size.');
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { mime: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { mime: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { mime: 'image/webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  }
  bad('Use a PNG, JPEG, WebP or GIF image.');
}

// The https link behind "Learn more". No credentials in it, no raw IP or localhost, short enough to store.
export function checkClickUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { bad('The link must be a full https address.'); }
  if (u.protocol !== 'https:') bad('The link must start with https://');
  if (u.username || u.password) bad('The link must not contain a login.');
  if (/^(localhost|.*\.local)$/i.test(u.hostname) || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':')) bad('The link must use a real domain name.');
  if (Buffer.byteLength(u.href) > LIMITS.url) bad(`The link is too long (max ${LIMITS.url} bytes).`);
  return u.href;
}

const text = (v, max, what) => {
  const s = String(v ?? '').trim();
  if (!s) bad(`${what} is required.`);
  if (Buffer.byteLength(s) > max) bad(`${what} is too long (max ${max} bytes).`);
  return s;
};

// The values a sponsor writes. All checks happen before anything is signed or paid for.
export function campaignValues({ eventSlug, spotId, sponsor, headline, clickUrl, alt, startsAt, endsAt, creative, status = 'active' }) {
  if (!Buffer.isBuffer(creative)) creative = Buffer.from(creative ?? []);
  if (creative.length > LIMITS.creativeBytes) bad(`The image is ${Math.round(creative.length / 1024)} KB; the limit is ${LIMITS.creativeBytes / 1024} KB. Compress it (a 640x360 WebP is usually 20-60 KB).`);
  const img = inspectImage(creative);
  if (!MIMES.includes(img.mime)) bad('Use a PNG, JPEG, WebP or GIF image.');
  if (img.width > LIMITS.maxSide || img.height > LIMITS.maxSide || img.width < 16 || img.height < 16) bad(`The image must be between 16 and ${LIMITS.maxSide} pixels on each side.`);
  const s = BigInt(startsAt), e = BigInt(endsAt);
  if (e <= s) bad('The campaign must end after it starts.');
  if (!['active', 'paused'].includes(status)) bad('Status must be active or paused.');
  return {
    eventSlug: text(eventSlug, 60, 'Event'),
    spotId: text(spotId, 20, 'Spot'),
    status,
    startsAt: u64(s),
    endsAt: u64(e),
    sponsor: text(sponsor, LIMITS.sponsor, 'Sponsor name'),
    headline: text(headline, LIMITS.headline, 'Headline'),
    clickUrl: checkClickUrl(clickUrl),
    alt: text(alt ?? headline, LIMITS.alt, 'Image description'),
    mime: img.mime,
    sha256: sha256Hex(creative),
    width: img.width,
    height: img.height,
    creative,
  };
}
