import { greatCircle } from './geo';

// Turns the live capture events into GeoJSON for the globe: a short blink (a dot with expanding rings) at the exact
// coordinates where a stamp was just minted. Pure function of (events, now), so it is easy to test.
// events: [{ from: [lng, lat], t0: ms }]

const clamp01 = (n) => Math.max(0, Math.min(1, n));
export const EMPTY = { type: 'FeatureCollection', features: [] };
export const BLINK_SECONDS = 2.4;

const pt = (coord, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coord } });

export function buildFeedGeoJSON(events, now) {
  const points = [];
  for (const e of events) {
    const age = (now - e.t0) / 1000;
    if (age < 0 || age > BLINK_SECONDS) continue;
    // two rings leave the spot one after the other
    for (const delay of [0, 0.45]) {
      const k = (age - delay) / 1.4;
      if (k >= 0 && k < 1) points.push(pt(e.from, { kind: 'ring', r: 4 + 24 * k, o: (1 - k) * 0.9, color: '#F26B21' }));
    }
    // the dot itself blinks on and off, then fades
    const on = age < 1.6 ? (Math.floor(age / 0.2) % 2 === 0 ? 1 : 0.25) : clamp01((BLINK_SECONDS - age) / 0.8);
    points.push(pt(e.from, { kind: 'dot', r: 5.5, o: on }));
  }
  return { points: { type: 'FeatureCollection', features: points } };
}
