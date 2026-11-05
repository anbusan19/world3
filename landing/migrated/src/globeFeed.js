import { greatCircle } from './geo';

// Turns the live capture events into GeoJSON for the globe: an arc flying from where a stamp was captured to the
// hub, a pulse where it happened, and a ripple when it arrives. Pure function of (events, now), so it is easy to test.
// events: [{ from: [lng, lat], t0: ms }]   hub: [lng, lat]

const clamp01 = (n) => Math.max(0, Math.min(1, n));
export const EMPTY = { type: 'FeatureCollection', features: [] };

const pt = (coord, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coord } });

export function buildFeedGeoJSON(events, now, hub) {
  const arcs = [];
  const points = [];

  for (const e of events) {
    const age = (now - e.t0) / 1000;
    if (age < 0 || age > 3.4) continue;

    // pulse + dot where it was captured
    const pulse = age / 1.3;
    if (pulse < 1) points.push(pt(e.from, { kind: 'ring', r: 4 + 26 * pulse, o: (1 - pulse) * 0.9, color: '#FFFFFF' }));
    if (age < 3) points.push(pt(e.from, { kind: 'dot', r: 5, o: clamp01(3 - age) }));

    // the arc head flies toward the hub, with a short tail behind it
    const head = clamp01((age - 0.15) / 1.7);
    const tail = Math.max(0, head - 0.38);
    if (head > 0) {
      const path = greatCircle(e.from, hub, 48);
      const a = Math.floor(tail * 48);
      const b = Math.max(a + 1, Math.ceil(head * 48));
      const seg = path.slice(a, b + 1);
      if (seg.length > 1) {
        const o = age > 2.4 ? clamp01(1 - (age - 2.4)) : 1;
        arcs.push({ type: 'Feature', properties: { o }, geometry: { type: 'LineString', coordinates: seg } });
      }
    }

    // ripple at the hub when it lands
    const land = (age - 1.85) / 1.3;
    if (land >= 0 && land < 1) points.push(pt(hub, { kind: 'ring', r: 6 + 30 * land, o: (1 - land) * 0.9, color: '#F26B21' }));
  }

  return {
    arcs: { type: 'FeatureCollection', features: arcs },
    points: { type: 'FeatureCollection', features: points },
  };
}
