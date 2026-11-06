import { createHash } from 'node:crypto';

// The public "explorer": recent stamps across everyone, with no personal data. A person shows up as their public
// passport name if they chose to publish one, otherwise as a short anonymous handle that only this feed uses.
// Pure function of the stores, so it is easy to test.

const handle = (userId) => `human-${createHash('sha1').update(String(userId)).digest('hex').slice(0, 4)}`;

export function explore({ captures, spots, passportOf = () => null }, { limit = 10, offset = 0, q = '', spotId = '' } = {}) {
  const byId = new Map(spots.map((s) => [s.id, s]));
  const needle = String(q).trim().toLowerCase();
  const all = captures
    .filter((c) => byId.has(c.spotId))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((c) => {
      const s = byId.get(c.spotId);
      const pp = passportOf(c.userId);
      return { spotId: s.id, spot: s.name, city: s.city, label: s.label, art: s.art ?? null, theme: s.theme, who: pp?.published && pp.name ? pp.name : handle(c.userId), at: c.at };
    });
  const filtered = all.filter((e) => (!spotId || e.spotId === spotId) && (!needle || `${e.spot} ${e.city} ${e.who}`.toLowerCase().includes(needle)));
  const lim = Math.max(1, Math.min(50, Number(limit) || 10));
  const off = Math.max(0, Number(offset) || 0);
  const counts = new Map();
  for (const e of all) counts.set(e.spotId, (counts.get(e.spotId) ?? 0) + 1);
  return {
    total: filtered.length,
    items: filtered.slice(off, off + lim),
    spots: spots.map((s) => ({ id: s.id, name: s.name, city: s.city, count: counts.get(s.id) ?? 0 })),
  };
}
