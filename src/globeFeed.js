import { greatCircle } from './geo';

// Turns the live capture events into GeoJSON for the globe: a short blink (a dot with expanding rings) at the exact
// coordinates where a stamp was just minted. Pure function of (events, now), so it is easy to test.
// events: [{ from: [lng, lat], t0: ms }]

const clamp01 = (n) => Math.max(0, Math.min(1, n));
export const EMPTY = { type: 'FeatureCollection', features: [] };
export const BLINK_SECONDS = 3.2;

const pt = (coord, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coord } });

export function buildFeedGeoJSON(events, now) {
  const points = [];
  for (const e of events) {
    const age = (now - e.t0) / 1000;
    if (age < 0 || age > BLINK_SECONDS) continue;
    const k = age / BLINK_SECONDS; // 0 -> 1
    // a soft, small ring that widens and fades while a tiny dot swells and fades: one quiet pulse
    points.push(pt(e.from, { kind: 'ring', r: 3 + 9 * k, o: 0.5 * (1 - k) * (1 - k) }));
    points.push(pt(e.from, { kind: 'dot', r: 2.2, o: Math.sin(Math.PI * k) * 0.9 }));
  }
  return { points: { type: 'FeatureCollection', features: points } };
}
