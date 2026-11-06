import { createHash } from 'node:crypto';

// The public "explorer": recent stamps across everyone. A person shows up as their wallet address (the address that owns
// their passport; never an ENS name, even if they published one), or, if the server has no wallets, a short anonymous handle.
// Pure function of the stores, so it is easy to test.

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const handle = (userId) => `human-${createHash('sha1').update(String(userId)).digest('hex').slice(0, 4)}`;

export function explore({ captures, spots, walletOf = () => null }, { limit = 10, offset = 0, q = '', spotId = '' } = {}) {
  const byId = new Map(spots.map((s) => [s.id, s]));
  const needle = String(q).trim().toLowerCase();
  const all = captures
    .filter((c) => byId.has(c.spotId))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((c) => {
      const s = byId.get(c.spotId);
      const wallet = walletOf(c.userId);
      return { spotId: s.id, spot: s.name, city: s.city, label: s.label, art: s.art ?? null, theme: s.theme, who: wallet ? short(wallet) : handle(c.userId), wallet: wallet ?? null, at: c.at };
    });
  const filtered = all.filter((e) => (!spotId || e.spotId === spotId) && (!needle || `${e.spot} ${e.city} ${e.who} ${e.wallet ?? ''}`.toLowerCase().includes(needle)));
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
