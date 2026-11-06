import { Scene, hex } from './glb.js';

// Cartoon versions of famous Indian landmarks, built from simple solids with the proportions of the real buildings
// (storeys, minarets, domes, arches), in a flat pastel palette. Each is scaled to 4 m tall so it stands comfortably
// in front of a person; set the real-world size in the dashboard if you want it bigger.
const C = {
  marble: hex('#EFE8D8'), marble2: hex('#DCD3C0'), dark: hex('#2E3340'), gold: hex('#F2C14E'), red: hex('#D2593F'), red2: hex('#B94A35'),
  sand: hex('#D9AE76'), sand2: hex('#C99A62'), cream: hex('#F3DDA0'), pink: hex('#EC8F86'), pink2: hex('#F6C4BC'), grey: hex('#B9B3A8'),
  grey2: hex('#8E8A82'), green: hex('#8CC152'), green2: hex('#5F9E2F'), water: hex('#3D8FD0'), steel: hex('#7C8794'), steel2: hex('#58616E'),
  brown: hex('#B98B5E'), blue: hex('#8FD3E4'), orange: hex('#F2994A'), lilac: hex('#B7A6E8'), teal: hex('#6FBF9C'),
};
const ring = (s, n, r, fn, start = 0) => { for (let i = 0; i < n; i++) { const a = start + (i / n) * 360; s.at({ ry: -a }, () => s.at({ x: r }, () => fn(i, a))); } };

export const LANDMARKS = {
  'taj-mahal'(s) {
    s.box(C.marble2, 0, 0, 0, 64, 4, 64);
    s.box(C.marble, 0, 4, 0, 30, 14, 24); s.box(C.marble, 0, 4, 0, 24, 14, 30);
    for (const a of [0, 90, 180, 270]) s.at({ ry: a }, () => { s.box(C.marble2, 0, 4, 15, 12, 14, 0.9); s.box(C.dark, 0, 5.5, 15.9, 6.4, 9, 0.5); s.cyl(C.dark, 0, 14.5, 15.9, 3.2, 3.2, 0.5, 14, { rx: 90 }); });
    s.cyl(C.marble, 0, 18, 0, 10, 9, 7, 24);
    s.dome(C.marble, 0, 25, 0, 11.5, 13, 24); s.cyl(C.marble, 0, 37, 0, 1.4, 0.8, 4, 8); s.cyl(C.gold, 0, 40.5, 0, 0.5, 0, 4, 8); s.ball(C.gold, 0, 39.5, 0, 1);
    for (const [x, z] of [[9.5, 9.5], [-9.5, 9.5], [9.5, -9.5], [-9.5, -9.5]]) { s.cyl(C.marble, x, 18, z, 1.5, 1.5, 5, 10); s.dome(C.marble, x, 23, z, 2.2, 2.6, 12); s.cyl(C.gold, x, 25.4, z, 0.3, 0, 2.2, 6); }
    for (const [x, z] of [[27, 27], [-27, 27], [27, -27], [-27, -27]]) {
      s.cyl(C.marble, x, 4, z, 2.8, 2.1, 30, 16);
      for (const h of [14, 22, 30]) s.cyl(C.marble2, x, 4 + h, z, 3.4, 3.4, 0.8, 16);
      s.cyl(C.marble, x, 34, z, 2.2, 2.2, 3.5, 10); s.dome(C.marble, x, 37.5, z, 2.7, 3, 12); s.cyl(C.gold, x, 40.4, z, 0.3, 0, 2, 6);
    }
    s.box(C.green, 0, 0, 40, 10, 0.6, 14); s.box(C.water, 0, 0.6, 40, 3.4, 0.2, 14);
  },

  'india-gate'(s) {
    s.frus(C.sand2, 0, 0, 0, 34, 20, 30, 16, 2); s.frus(C.sand2, 0, 2, 0, 30, 16, 27, 13, 2);
    s.box(C.sand, 0, 4, 0, 24, 20, 9);
    s.box(C.dark, 0, 4, 0, 9, 12, 10); s.cyl(C.dark, 0, 16, 0, 4.5, 4.5, 10, 20, { rx: 90, z: -5 });
    s.box(C.cream, 0, 24, 0, 26, 2, 11); s.box(C.sand2, 0, 26, 0, 25, 1.2, 10.5); s.box(C.cream, 0, 20.5, 5.05, 18, 2, 0.3);
    s.cyl(C.sand, 0, 27.2, 0, 6, 5, 1.2, 24); s.cyl(C.dark, 0, 28.2, 0, 5.2, 4.6, 0.6, 24); s.cyl(C.orange, 0, 28.6, 0, 1.2, 0.2, 2.2, 8);
    for (const x of [-10.5, 10.5]) { s.box(C.sand2, x, 4, 0, 3, 18, 9.4); }
  },

  'qutub-minar'(s) {
    s.box(C.sand2, 0, 0, 0, 22, 1.5, 22);
    const tiers = [[7.4, 6.2, 22, C.red, 12], [6.2, 5.1, 16, C.red2, 12], [5.1, 4.3, 12, C.red, 12], [4.3, 3.7, 8, C.sand, 16], [3.7, 3.2, 6, C.cream, 16]];
    let y = 1.5;
    for (const [r0, r1, h, c, seg] of tiers) { s.cyl(c, 0, y, 0, r0, r1, h, seg); y += h; s.cyl(C.dark, 0, y - 0.9, 0, r1 + 1.4, r1 + 1.4, 1, 20); s.cyl(C.sand2, 0, y - 0.4, 0, r1 + 1.9, r1 + 1.9, 0.5, 20); }
    s.cyl(C.cream, 0, y, 0, 2.4, 2.2, 3, 12); s.dome(C.gold, 0, y + 3, 0, 2.4, 2, 12); s.cyl(C.gold, 0, y + 4.8, 0, 0.3, 0, 2, 6);
  },

  'charminar'(s) {
    s.box(C.marble2, 0, 0, 0, 30, 1, 30);
    s.box(C.marble, 0, 1, 0, 20, 12, 20); s.box(C.marble, 0, 13, 0, 18, 5, 18); s.box(C.marble2, 0, 18, 0, 19, 1, 19);
    for (const a of [0, 90, 180, 270]) s.at({ ry: a }, () => {
      s.box(C.dark, 0, 1, 9.6, 8, 9.5, 1); s.cyl(C.dark, 0, 10.5, 9.6, 4, 4, 1, 16, { rx: 90, y: 10.5 });
      for (const x of [-6, 6]) s.box(C.dark, x, 14, 9.1, 2, 3, 0.5);
      for (let i = -3; i <= 3; i++) s.box(C.marble2, i * 2.4, 19, 9.2, 1.2, 1.3, 0.6);
    });
    for (const [x, z] of [[11, 11], [-11, 11], [11, -11], [-11, -11]]) {
      s.cyl(C.marble, x, 1, z, 2.3, 1.7, 27, 14); for (const h of [10, 19]) s.cyl(C.marble2, x, h, z, 2.7, 2.7, 0.8, 14);
      s.cyl(C.marble, x, 24, z, 1.9, 1.9, 4, 10); s.dome(C.marble2, x, 28, z, 2.3, 2.8, 12); s.cyl(C.gold, x, 30.6, z, 0.3, 0, 2, 6);
    }
    s.box(C.marble, 0, 19, 0, 9, 3.5, 9); s.dome(C.marble2, 0, 22.5, 0, 4.2, 4, 14); for (const x of [-5.5, 5.5]) s.dome(C.marble2, x, 19, 5.5, 1.6, 2.4, 10);
  },

  'hawa-mahal'(s) {
    const widths = [28, 26, 21, 15, 9]; const heights = [6, 4.6, 4.6, 4, 4]; let y = 0;
    s.box(C.pink2, 0, 0, 0, 32, 1, 8);
    y = 1;
    widths.forEach((w, t) => {
      const h = heights[t]; const d = 5.2 - t * 0.5;
      s.box(C.pink, 0, y, 0, w, h, d); s.box(C.pink2, 0, y + h - 0.5, d / 2 - 0.1, w + 0.8, 0.7, 0.8); s.box(C.pink2, 0, y, d / 2 - 0.1, w + 0.8, 0.5, 0.8);
      const n = Math.max(2, Math.floor(w / 3.2));
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * (w / n); const wy = y + h / 2 - 1;
        s.box(C.pink2, x, wy - 0.2, d / 2 + 0.05, 2, 2.9, 0.5); s.box(C.dark, x, wy, d / 2 + 0.3, 1.4, 2.2, 0.4); s.dome(C.pink2, x, wy + 2.6, d / 2 + 0.1, 1.05, 0.9, 8);
        if (t > 0 && t < 4) s.box(C.pink2, x, wy - 1.3, d / 2 + 0.6, 1.9, 0.4, 1.0); // little balcony
      }
      if (t > 0) { s.cyl(C.pink2, -w / 2 + 1.3, y + h, 0, 0.7, 0.7, 2, 8); s.dome(C.marble, -w / 2 + 1.3, y + h + 2, 0, 1.1, 1.2, 8); s.cyl(C.pink2, w / 2 - 1.3, y + h, 0, 0.7, 0.7, 2, 8); s.dome(C.marble, w / 2 - 1.3, y + h + 2, 0, 1.1, 1.2, 8); }
      y += h;
    });
    s.dome(C.marble, 0, y, 0, 2.4, 2.8, 12); s.cyl(C.gold, 0, y + 2.8, 0, 0.3, 0, 1.8, 6);
  },

  'lotus-temple'(s) {
    s.cyl(C.marble2, 0, 0, 0, 22, 21, 1.2, 30);
    ring(s, 9, 15.8, () => { s.cyl(C.green, 0, 0, 0, 3.4, 3.4, 0.4, 14); s.cyl(C.water, 0, 0.4, 0, 3, 3, 0.2, 14); }, 20);
    // three rings of nine cupped petals, each leaning in so the whole thing closes like a bud
    [[10.8, 11.5, 15, hex('#E6DCC6'), 0], [7.6, 16.5, 17, hex('#F8F3E6'), 20], [4.3, 20.5, 9, hex('#E9E0CB'), 0]].forEach(([r, h, tilt, c, off]) => {
      const tw = ((2 * Math.PI * r) / 9) * 0.98;
      ring(s, 9, r, () => { s.frus(c, 0, 1.2, 0, 1.8, tw, 1.0, tw * 0.5, h, { rz: tilt }); s.frus(C.marble2, 0.2, 1.2, 0, 0.5, tw * 0.9, 0.3, tw * 0.3, h * 0.97, { rz: tilt }); }, off);
    });
    s.dome(C.marble, 0, 19, 0, 2.2, 2.6, 12);
  },

  'victoria-memorial'(s) {
    s.box(C.marble2, 0, 0, 0, 46, 1.5, 30);
    s.box(C.marble, 0, 1.5, 0, 36, 11, 22); s.box(C.marble2, 0, 12.5, 0, 38, 1, 24);
    for (let i = -7; i <= 7; i++) s.box(C.dark, i * 2.3, 3, 11.05, 1.1, 4.5, 0.4);
    s.box(C.marble, 0, 1.5, 12, 14, 12, 4); s.frus(C.marble2, 0, 13.5, 12, 15, 5, 15, 3, 2.5);
    for (let i = -3; i <= 3; i++) s.cyl(C.marble2, i * 2, 1.5, 14.4, 0.5, 0.5, 10.5, 8);
    s.box(C.dark, 0, 1.5, 14.1, 5, 7, 0.5);
    for (const x of [-20, 20]) { s.box(C.marble, x, 1.5, 6, 6, 9, 10); s.dome(C.marble2, x, 10.5, 6, 3.4, 3.6, 12); }
    s.cyl(C.marble, 0, 13.5, 0, 8, 7.4, 9, 24); for (let i = 0; i < 8; i++) s.at({ ry: i * 45 }, () => s.box(C.dark, 0, 15.5, 7.6, 1.6, 4, 0.5));
    s.dome(C.marble, 0, 22.5, 0, 8.4, 9.5, 24); s.cyl(C.marble2, 0, 31.5, 0, 1.2, 0.8, 3, 8); s.cyl(C.gold, 0, 34.3, 0, 0.9, 0, 3.2, 8); s.ball(C.gold, 0, 33.7, 0, 0.9);
    for (const [x, z] of [[17.5, 9.5], [-17.5, 9.5], [17.5, -9.5], [-17.5, -9.5]]) { s.cyl(C.marble, x, 13.5, z, 2.4, 2.2, 6, 8); s.dome(C.marble2, x, 19.5, z, 2.8, 3, 10); s.cyl(C.gold, x, 22.3, z, 0.3, 0, 1.6, 6); }
  },

  'golden-temple'(s) {
    s.box(C.marble, 0, 0, 0, 56, 1.4, 56);
    s.cyl(C.water, 0, 1.4, 0, 24, 24, 0.3, 32);
    s.box(C.marble2, 0, 1.4, 0, 3.4, 0.6, 14, { z: 11 }); s.at({ z: 11 }, () => 0);
    s.box(C.marble, 0, 1.4, 0, 3.6, 0.8, 16, {}); // causeway
    s.at({ z: 0 }, () => {});
    s.box(C.marble, 0, 1.7, 0, 13, 7, 13); s.box(C.gold, 0, 8.7, 0, 11.5, 5, 11.5); s.box(C.marble2, 0, 8.5, 0, 12.4, 0.5, 12.4); s.box(C.marble2, 0, 13.6, 0, 12.4, 0.5, 12.4);
    for (const a of [0, 90, 180, 270]) s.at({ ry: a }, () => { s.box(C.dark, 0, 2.7, 6.6, 3, 4.5, 0.4); for (const x of [-3.6, 3.6]) s.box(C.dark, x, 10, 5.9, 1.4, 2.6, 0.3); });
    for (const [x, z] of [[5, 5], [-5, 5], [5, -5], [-5, -5]]) { s.cyl(C.gold, x, 14, z, 0.9, 0.9, 2.2, 8); s.dome(C.gold, x, 16.2, z, 1.3, 1.5, 10); }
    s.cyl(C.gold, 0, 14, 0, 4.2, 4.0, 1, 20); s.dome(C.gold, 0, 15, 0, 4, 4.8, 20); s.cyl(C.gold, 0, 19.8, 0, 0.5, 0, 3, 8);
    for (const [x, z, w, d] of [[0, 27, 56, 2], [0, -27, 56, 2], [27, 0, 2, 52], [-27, 0, 2, 52]]) s.box(C.marble2, x, 1.4, z, w, 2.4, d);
  },

  'meenakshi-gopuram'(s) {
    s.box(C.grey, 0, 0, 0, 26, 9, 15); s.box(C.dark, 0, 0, 7.4, 6, 7, 0.6); s.box(C.marble, 0, 9, 0, 27, 0.8, 16);
    const cols = [C.orange, C.gold, C.teal, C.pink2, C.blue, C.lilac]; let y = 9.8;
    for (let i = 0; i < 9; i++) {
      const w0 = 23 - i * 1.5; const w1 = 23 - (i + 1) * 1.5; const d0 = 12.5 - i * 0.8; const d1 = 12.5 - (i + 1) * 0.8; const h = 2.7;
      s.frus(cols[i % cols.length], 0, y, 0, w0, d0, w1 + 0.4, d1 + 0.3, h); s.box(C.marble, 0, y, 0, w0 + 0.5, 0.35, d0 + 0.5);
      const n = Math.max(2, Math.floor(w0 / 2.4));
      for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * (w0 / n * 0.9); s.box(C.marble, x, y + 0.7, d0 / 2 + 0.05, 0.9, 1.4, 0.5); s.box(C.dark, x, y + 0.9, d0 / 2 + 0.35, 0.45, 0.9, 0.3); }
      y += h;
    }
    s.box(C.marble, 0, y, 0, 11.5, 0.6, 5.4); s.cyl(C.red, 0, y + 0.6, 0, 2.3, 2.3, 11, 16, { rz: 90, x: 5.5 }); s.box(C.red2, 0, y + 0.6, 0, 11, 1.4, 4.4);
    for (let i = 0; i < 7; i++) { const x = (i - 3) * 1.6; s.cyl(C.gold, x, y + 3.0, 0, 0.55, 0.4, 1.4, 8); s.cyl(C.gold, x, y + 4.4, 0, 0.4, 0, 1.3, 8); }
  },

  'gol-gumbaz'(s) {
    s.box(C.grey2, 0, 0, 0, 40, 1.2, 40);
    s.box(C.sand, 0, 1.2, 0, 32, 20, 32); s.box(C.sand2, 0, 21.2, 0, 33, 1.6, 33);
    for (const a of [0, 90, 180, 270]) s.at({ ry: a }, () => { for (const x of [-9, 0, 9]) { s.box(C.dark, x, 4, 16.05, 4.6, 9, 0.5); s.dome(C.dark, x, 13, 16.05, 2.3, 2, 10, { rx: 0 }); } for (let i = -7; i <= 7; i++) s.box(C.sand2, i * 2, 22.8, 16.2, 0.9, 1.2, 0.6); });
    for (const [x, z] of [[17.5, 17.5], [-17.5, 17.5], [17.5, -17.5], [-17.5, -17.5]]) { s.cyl(C.sand, x, 1.2, z, 3.5, 3.2, 28, 8); for (const h of [8, 15, 22]) s.cyl(C.sand2, x, h, z, 4.0, 4.0, 0.8, 8); s.cyl(C.sand, x, 29, z, 2.6, 2.6, 2.5, 8); s.dome(C.sand2, x, 31.5, z, 3, 3.2, 10); }
    s.cyl(C.sand2, 0, 22.8, 0, 15.2, 15, 2, 28); s.dome(C.sand, 0, 24.8, 0, 14.6, 14.5, 28); s.cyl(C.sand2, 0, 39.1, 0, 0.7, 0.4, 3, 8); s.cyl(C.gold, 0, 42, 0, 0.5, 0, 2.2, 6);
  },

  'sanchi-stupa'(s) {
    s.cyl(C.sand2, 0, 0, 0, 21, 21, 1, 30);
    s.cyl(C.sand, 0, 1, 0, 16.5, 16, 4.5, 28); s.cyl(C.sand2, 0, 5.5, 0, 17, 17, 0.8, 28);
    s.dome(C.marble, 0, 5.5, 0, 15, 14, 28);
    s.box(C.sand, 0, 19.2, 0, 5.2, 2.4, 5.2); s.box(C.sand2, 0, 21.6, 0, 6, 0.5, 6);
    s.cyl(C.sand2, 0, 20, 0, 0.4, 0.4, 7, 8); for (const [r, y] of [[3.2, 24], [2.3, 25.6], [1.4, 27]]) s.cyl(C.sand, 0, y, 0, r, r, 0.4, 14);
    s.cyl(C.gold, 0, 27.4, 0, 0.3, 0, 2, 6);
    s.cyl(C.marble2, 0, 1, 0, 19, 19, 0.5, 30);
    for (const a of [0, 90, 180, 270]) s.at({ ry: a }, () => { s.at({ z: 24 }, () => {
      s.box(C.sand, -4.4, 0, 0, 1.6, 15, 1.6); s.box(C.sand, 4.4, 0, 0, 1.6, 15, 1.6);
      [[12, 13], [14.6, 15.4], [17.2, 17.6]].forEach(([y, w], i) => { s.box(C.sand2, 0, y, 0, w - 2 + i, 1.4, 1.2); for (const x of [-1, 1]) s.cyl(C.sand, x * (w / 2 - 0.8 + i / 2), y + 0.7, 0, 0.9, 0.9, 1.5, 12, { rx: 90, z: -0.75 }); });
      s.cyl(C.sand, 0, 18.6, 0, 1.4, 1.4, 0.5, 14, { rx: 90, z: -0.2 });
    }); });
  },

  'mahabodhi-temple'(s) {
    s.box(C.grey, 0, 0, 0, 34, 3, 34); s.box(C.sand2, 0, 3, 0, 28, 1, 28);
    const tiers = [[12.5, 10.4, 7], [10.4, 8.6, 6.5], [8.6, 6.8, 6], [6.8, 5, 5.5], [5, 3.6, 4.5]]; let y = 4;
    tiers.forEach(([a, b, h], i) => { s.frus(i % 2 ? C.sand : C.sand2, 0, y, 0, a, a, b, b, h); for (const r of [0, 90, 180, 270]) s.at({ ry: r }, () => { for (const x of [-a * 0.22, a * 0.22]) s.box(C.dark, x, y + h * 0.35, a / 2 - 0.05 - (a - b) / 4, 0.9, h * 0.4, 0.4); }); y += h; });
    s.cyl(C.sand, 0, y, 0, 2.6, 2.2, 1.6, 12); s.dome(C.sand2, 0, y + 1.6, 0, 2.2, 2.2, 12); s.cyl(C.gold, 0, y + 3.7, 0, 0.5, 0, 3, 8);
    s.box(C.sand, 0, 4, 9, 6.5, 8, 6); s.box(C.dark, 0, 4, 12.05, 2.6, 5, 0.5); s.frus(C.sand2, 0, 12, 9, 7, 6.4, 3.4, 3, 3);
    for (const [x, z] of [[11.5, 11.5], [-11.5, 11.5], [11.5, -11.5], [-11.5, -11.5]]) { s.frus(C.sand, x, 4, z, 5, 5, 2.4, 2.4, 11); s.dome(C.sand2, x, 15, z, 1.5, 1.8, 10); s.cyl(C.gold, x, 16.7, z, 0.25, 0, 1.4, 6); }
    s.cyl(C.brown, 0, 0, 0, 0.9, 0.7, 6, 8, { x: -19, z: 6 }); s.ball(C.green, -19, 5, 6, 4, 6); s.ball(C.green2, -16, 5.4, 4, 3, 4.4);
  },

  'brihadisvara-temple'(s) {
    s.box(C.grey2, 0, 0, 0, 34, 1.2, 34);
    s.box(C.grey, 0, 1.2, 0, 22, 14, 22); s.box(C.sand2, 0, 15.2, 0, 23, 1, 23);
    for (const a of [0, 90, 180, 270]) s.at({ ry: a }, () => { for (const x of [-6, 6]) { s.box(C.dark, x, 3, 11.05, 2.2, 3.8, 0.5); s.box(C.dark, x, 9, 11.05, 2.2, 3.8, 0.5); } s.box(C.dark, 0, 1.2, 11.05, 3, 5, 0.5); });
    let y = 16.2; for (let i = 0; i < 13; i++) { const w0 = 19.5 - i * 0.95; const w1 = 19.5 - (i + 1) * 0.95; s.frus(i % 2 ? C.grey : C.sand, 0, y, 0, w0, w0, w1 + 0.2, w1 + 0.2, 2); s.box(C.grey2, 0, y + 1.6, 0, w0 + 0.3, 0.4, w0 + 0.3); y += 2; }
    s.box(C.grey, 0, y, 0, 7, 2.4, 7); s.dome(C.marble, 0, y + 2.4, 0, 3.6, 3.4, 8); s.cyl(C.gold, 0, y + 5.7, 0, 0.5, 0, 3, 8);
    s.box(C.grey, 0, 1.2, 0, 14, 7, 12, { z: 20 }); s.frus(C.sand2, 0, 8.2, 20, 14.6, 12.6, 10, 8, 2.5); s.box(C.dark, 0, 1.2, 26.05, 3, 5, 0.5);
    s.box(C.grey2, 0, 1.2, 0, 5, 3, 4, { x: 0, z: 31 }); s.dome(C.grey, 0, 4.2, 31, 1.4, 1.6, 8);
  },

  'howrah-bridge'(s) {
    s.box(C.water, 0, 0, 0, 100, 0.4, 22);
    s.box(C.steel2, 0, 7, 0, 92, 1, 8); s.box(C.steel, 0, 8, 3.7, 92, 0.6, 0.4); s.box(C.steel, 0, 8, -3.7, 92, 0.6, 0.4);
    for (const x of [-16, 16]) for (const z of [-3.6, 3.6]) { s.frus(C.steel, x, 0.4, z, 2.2, 2.2, 1.4, 1.4, 34); }
    for (const x of [-16, 16]) { s.box(C.steel2, x, 34, 0, 2.6, 1.8, 9.6); for (const h of [12, 22]) s.box(C.steel2, x, h, 0, 1.2, 1.4, 8); s.box(C.steel2, x, 21, -3.6, 0.6, 12, 0.6, { rx: 0 }); }
    const chord = (x0, y0, x1, y1) => { const dx = x1 - x0; const dy = y1 - y0; const len = Math.hypot(dx, dy); const ang = (Math.atan2(dy, dx) * 180) / Math.PI; for (const z of [-3.6, 3.6]) s.box(C.steel, x0, y0 - 0.5, z, len, 1.2, 1.2, { rz: ang, x: x0 }); };
    const pts = (sign) => [[16, 34.5], [26, 28], [35, 20], [42, 14], [48, 8]].map(([x, y]) => [x * sign, y]);
    for (const sign of [1, -1]) { const p = pts(sign); for (let i = 0; i < p.length - 1; i++) { const [a, b] = sign === 1 ? [p[i], p[i + 1]] : [p[i + 1], p[i]]; chord(a[0], a[1], b[0], b[1]); } for (const [x, y] of p.slice(1)) for (const z of [-3.6, 3.6]) s.box(C.steel, x, 8, z, 0.5, y - 8, 0.5); }
    const mid = [[-16, 34.5], [-8, 27], [0, 24], [8, 27], [16, 34.5]]; for (let i = 0; i < mid.length - 1; i++) chord(mid[i][0], mid[i][1], mid[i + 1][0], mid[i + 1][1]);
    for (const [x, y] of mid.slice(1, -1)) for (const z of [-3.6, 3.6]) s.box(C.steel, x, 8, z, 0.5, y - 8, 0.5);
    for (const sx of [-1, 1]) s.box(C.grey, sx * 49, 0.4, 0, 6, 7.6, 10);
    for (let i = 0; i < 6; i++) s.box(C.gold, -30 + i * 12, 8.6, 0, 3, 0.4, 0.5);
  },

  'red-fort'(s) {
    s.box(C.grey2, 0, 0, 0, 62, 1, 20);
    s.box(C.red, 0, 1, 0, 52, 11, 5); for (let i = -12; i <= 12; i++) s.box(C.red2, i * 2.1, 12, 0, 1.2, 1.4, 5.4);
    s.box(C.red, 0, 1, 4, 14, 15, 8); s.box(C.red2, 0, 16, 4, 15, 1.4, 9); s.box(C.dark, 0, 1, 8.05, 6, 9.5, 0.6); s.cyl(C.dark, 0, 10.5, 8.05, 3, 3, 0.6, 16, { rx: 90, y: 10.5 });
    for (const x of [-4.6, 0, 4.6]) { s.cyl(C.marble, x, 17.4, 4, 1.1, 1.1, 2.6, 10); s.dome(C.marble, x, 20, 4, 1.7, 2.1, 12); s.cyl(C.gold, x, 22.1, 4, 0.2, 0, 1.2, 6); }
    for (const x of [-12, 12]) { s.cyl(C.red, x, 1, 4, 4.6, 4.2, 13, 8); s.cyl(C.red2, x, 13.2, 4, 5, 5, 1, 8); s.cyl(C.marble, x, 14.2, 4, 2.4, 2.4, 3, 8); s.dome(C.marble, x, 17.2, 4, 3.2, 3.2, 10); s.cyl(C.gold, x, 20.3, 4, 0.25, 0, 1.4, 6); }
    s.cyl(C.marble2, 0, 22.2, 4, 0.2, 0.2, 5, 6); s.box(C.orange, 0.8, 26, 4, 1.6, 0.5, 0.1); s.box(C.marble, 0.8, 25.5, 4, 1.6, 0.5, 0.1); s.box(C.green, 0.8, 25, 4, 1.6, 0.5, 0.1);
  },

  'mysore-palace'(s) {
    s.box(C.grey, 0, 0, 0, 60, 1, 22);
    s.box(C.cream, 0, 1, 0, 46, 12, 11); s.box(C.grey, 0, 13, 0, 47, 1, 12);
    for (let i = -9; i <= 9; i++) { s.box(C.dark, i * 2.35, 2, 5.55, 1.6, 4.8, 0.4); s.dome(C.dark, i * 2.35, 6.8, 5.55, 0.8, 1, 8); s.box(C.dark, i * 2.35, 8.6, 5.55, 1.2, 2, 0.4); }
    s.box(C.cream, 0, 1, 7.5, 16, 12, 4); for (const x of [-5, 0, 5]) { s.box(C.dark, x, 1.5, 9.55, 3.6, 7, 0.4); s.dome(C.dark, x, 8.5, 9.55, 1.8, 1.8, 10); }
    for (const x of [-4, 0, 4]) { s.box(C.cream, x * 0.5, 13, 0, 8, 6, 8); }
    s.box(C.cream, 0, 14, 0, 9, 8, 9); s.cyl(C.cream, 0, 22, 0, 3.8, 3.4, 5, 8); s.dome(C.gold, 0, 27, 0, 4.4, 5.2, 14); s.cyl(C.gold, 0, 32, 0, 0.5, 0, 3, 8);
    for (const [x, z, r] of [[21, 0, 3.2], [-21, 0, 3.2], [16, 5, 2.4], [-16, 5, 2.4]]) { s.cyl(C.cream, x, 14, z, r, r - 0.2, 4, 8); s.dome(C.gold, x, 18, z, r + 0.4, r * 1.2, 12); s.cyl(C.gold, x, 18 + r * 1.2, z, 0.25, 0, 1.4, 6); }
    for (const x of [-23, 23]) { s.box(C.cream, x, 1, 0, 6, 16, 8); s.dome(C.pink2, x, 17, 0, 3.6, 4, 12); }
  },

  'konark-sun-temple'(s) {
    s.box(C.sand2, 0, 0, 0, 34, 1, 24);
    s.box(C.sand, 0, 1, 0, 28, 3, 16); s.box(C.sand2, 0, 4, 0, 29, 0.8, 17);
    for (const side of [-1, 1]) for (let i = -2; i <= 2; i++) s.at({ x: i * 5.6, y: 3, z: side * 8.7 }, () => {
      s.cyl(C.sand2, 0, 0, 0, 3.4, 3.4, 0.7, 24, { rx: 90, z: -0.35 }); s.cyl(C.dark, 0, 0, 0, 0.9, 0.9, 1, 12, { rx: 90, z: -0.5 });
      for (let k = 0; k < 8; k++) s.box(C.sand2, 0, 0, 0, 0.5, 6.6, 0.6, { rz: k * 22.5, y: -3.3 });
      s.cyl(C.red2, 0, 0, 0, 3.7, 3.7, 0.3, 24, { rx: 90, z: -0.5 });
    });
    for (let i = 0; i < 7; i++) { const x = (i - 3) * 3.6; s.at({ x, y: 1, z: 10.4 }, () => { for (const lx of [-0.45, 0.45]) for (const lz of [-0.9, 0.9]) s.box(C.brown, lx, 0, lz, 0.3, 1.5, 0.3); s.box(C.brown, 0, 1.5, 0, 1.3, 1.3, 2.6); s.box(C.brown, 0, 2.3, 1.5, 0.8, 1.6, 0.9, { rx: -20 }); s.box(C.brown, 0, 3.4, 2.1, 0.7, 0.7, 1.1); s.box(C.dark, 0, 3.7, 2.1, 0.8, 0.12, 0.3); }); }
    s.box(C.sand, 0, 4.8, 0, 14, 4, 12, { z: -3 }); s.frus(C.sand, 0, 8.8, -3, 14, 12, 10, 8, 3); s.frus(C.sand2, 0, 11.8, -3, 10, 8, 6, 5, 2.6); s.frus(C.sand, 0, 14.4, -3, 6, 5, 3, 3, 2.2); s.cyl(C.sand2, 0, 16.6, -3, 1.8, 1.8, 0.8, 12); s.dome(C.sand, 0, 17.4, -3, 1.6, 1.4, 10); s.cyl(C.gold, 0, 18.6, -3, 0.25, 0, 1.4, 6);
    s.box(C.dark, 0, 4.8, 3.05, 4, 3, 0.4); for (const x of [-5.5, 5.5]) s.cyl(C.sand2, x, 4.8, 3.6, 0.5, 0.5, 3.8, 8);
  },

  'gateway-of-india'(s) {
    s.box(C.grey2, 0, 0, 0, 44, 0.8, 24); s.frus(C.sand2, 0, 0.8, 0, 30, 18, 28, 16, 1.6);
    s.box(C.sand, 0, 2.4, 0, 22, 20, 12); s.box(C.dark, 0, 2.4, 0, 8, 12, 13); s.cyl(C.dark, 0, 14.4, 0, 4, 4, 13, 20, { rx: 90, z: -6.5 });
    s.box(C.sand2, 0, 22.4, 0, 23, 1.6, 13); for (let i = -4; i <= 4; i++) s.box(C.sand, i * 2.5, 24, 6.1, 1.4, 1.6, 0.6);
    for (const [x, z] of [[10.5, 5], [-10.5, 5], [10.5, -5], [-10.5, -5]]) { s.cyl(C.sand, x, 22.4, z, 1.8, 1.6, 5.5, 8); s.dome(C.sand2, x, 27.9, z, 2.1, 2.2, 10); s.cyl(C.gold, x, 30, z, 0.2, 0, 1.2, 6); }
    s.cyl(C.sand, 0, 22.4, 0, 6.6, 6.2, 1.6, 24); s.dome(C.sand2, 0, 24, 0, 6.4, 5.6, 24); s.cyl(C.gold, 0, 29.4, 0, 0.35, 0, 2.2, 6);
    for (const x of [-15.5, 15.5]) { s.box(C.sand, x, 0.8, 0, 7, 10, 10); s.box(C.dark, x, 1.5, 5.05, 2.6, 5.6, 0.4); s.dome(C.sand2, x, 10.8, 0, 3.2, 2.6, 12); }
  },

  'csmt'(s) {
    s.box(C.grey2, 0, 0, 0, 62, 1, 26);
    s.box(C.sand, 0, 1, 0, 52, 13, 14); s.box(C.sand2, 0, 14, 0, 53, 1, 15);
    for (let i = -10; i <= 10; i++) { s.box(C.dark, i * 2.4, 2.5, 7.05, 1.2, 4.5, 0.4); s.cyl(C.dark, i * 2.4, 7, 7.05, 0.6, 0.6, 0.4, 8, { rx: 90 }); s.box(C.dark, i * 2.4, 9.5, 7.05, 1, 3, 0.4); }
    s.box(C.sand, 0, 1, 9, 20, 13, 6); s.box(C.sand, 0, 15, 4, 14, 8, 12); s.cyl(C.sand2, 0, 23, 4, 7, 6.4, 3, 8); s.cyl(C.sand, 0, 26, 4, 6, 5.4, 4, 8); s.dome(C.blue, 0, 30, 4, 5.8, 8, 16); s.cyl(C.sand2, 0, 38, 4, 0.8, 0.5, 3, 8); s.cyl(C.gold, 0, 41, 4, 0.5, 0, 2.4, 6); s.ball(C.gold, 0, 40, 4, 0.7);
    for (const x of [-20, 20]) { s.box(C.sand, x, 1, 5, 10, 13, 8); s.frus(C.sand2, x, 14, 5, 11, 9, 0, 0, 7); }
    for (const [x, z] of [[8, 9], [-8, 9], [10.5, 9], [-10.5, 9]]) { s.cyl(C.sand, x, 15, z, 1.2, 1.1, 7, 8); s.cyl(C.sand2, x, 22, z, 1.5, 0, 4, 8); }
    for (const x of [-26, 26]) { s.cyl(C.sand, x, 1, 0, 2.6, 2.4, 15, 8); s.cyl(C.sand2, x, 16, 0, 3.2, 0, 5, 8); }
    for (const x of [-2.6, 2.6]) s.box(C.dark, x, 2, 9.05 + 3, 1.6, 6, 0.4);
  },

  'khajuraho-temple'(s) {
    const K = { a: hex('#DDA987'), b: hex('#C4896A') };
    s.box(K.b, 0, 0, 0, 34, 3.5, 22); s.box(K.a, 0, 3.5, 0, 30, 0.8, 18); for (let i = -6; i <= 6; i++) s.box(K.b, i * 2.4, 4.3, 9.1, 1.2, 1.2, 0.6);
    s.box(K.a, 0, 4.3, 0, 8, 8, 8, { z: -4 }); s.box(C.dark, 0, 5, 0.05, 3, 4, 0.5);
    const tow = [[9, 8.4, 7, 22, 0], [9, 12, 8, 14, 0.2]]; let y = 12.3;
    for (let i = 0; i < 8; i++) { const w0 = 9 - i * 0.95; const w1 = 9 - (i + 1) * 0.95; s.frus(i % 2 ? K.a : K.b, 0, y, -4, w0, w0, w1 + 0.25, w1 + 0.25, 2.1); y += 2.1; }
    s.cyl(K.b, 0, y, -4, 1.9, 1.7, 0.9, 12); s.cyl(K.a, 0, y + 0.9, -4, 1.2, 1.2, 0.6, 12); s.cyl(C.gold, 0, y + 1.5, -4, 0.3, 0, 1.4, 6);
    for (const [x, z] of [[4.3, 0.3], [-4.3, 0.3], [4.3, -8.3], [-4.3, -8.3]]) { let yy = 12.3; for (let i = 0; i < 4; i++) { const w = 3 - i * 0.55; s.frus(K.a, x, yy, z, w, w, w - 0.55, w - 0.55, 1.6); yy += 1.6; } s.cyl(K.b, x, yy, z, 0.8, 0, 1, 8); }
    let z0 = 5; [[10, 8, 5, 2.6], [8, 6, 4, 2.4], [6, 5, 3, 2]].forEach(([w, d, h, th], i) => { s.box(K.a, 0, 4.3, z0 + i * 0 - 5 + (i * 5), w, h, d, {}); s.frus(K.b, 0, 4.3 + h, z0 - 5 + i * 5, w + 0.4, d + 0.4, w * 0.35, d * 0.35, th); });
  },

  // ---- the sponsor logos, in 3D: a cartoon plinth with the mark standing on it ----
  'ens-logo'(s) {
    const blue = hex('#0080BC'); const sky = hex('#5298FF'); const base = hex('#DCEBFA');
    s.cyl(base, 0, 0, 0, 5.2, 4.8, 0.9, 32); s.cyl(hex('#9CC8EA'), 0, 0.9, 0, 4.4, 4.2, 0.3, 32);
    // the ENS mark: two tall faceted gems leaning against each other
    const gem = (c, x, y, tilt) => s.at({ x, y: 1.2 + y, rz: tilt }, () => { s.frus(c, 0, 0, 0, 3.2, 3.2, 0, 0, 5.4); s.frus(c, 0, 0, 0, 3.2, 3.2, 0, 0, 5.4, { rx: 180 }); });
    gem(sky, -1.0, 5.4, 16); gem(blue, 1.0, 3.2, 16);
    s.ball(blue, 0, 1.2, 0, 0.0001);
  },
  'arkiv-logo'(s) {
    const o = hex('#F26B21'); const o2 = hex('#F9A06A'); const w = hex('#FFFFFF');
    s.cyl(hex('#FFE9D6'), 0, 0, 0, 5.2, 4.8, 0.9, 32); s.cyl(hex('#F7C59F'), 0, 0.9, 0, 4.4, 4.2, 0.3, 32);
    // the Arkiv mark: a cube seen corner-on, sitting on a corner so the edges form the hexagon of the logo
    s.at({ y: 1.2 + 0.9, ry: 45 }, () => {
      s.box(o, 0, 0, 0, 5.4, 5.4, 5.4); s.box(o2, 0, 5.39, 0, 5.42, 0.12, 5.42);
      for (const [x, z] of [[2.71, 2.71], [-2.71, 2.71], [2.71, -2.71], [-2.71, -2.71]]) s.box(w, x, 0, z, 0.16, 5.4, 0.16);
    });
  },
  'world-logo'(s) {
    const k = hex('#0B0B0F'); const w = hex('#F4F1EA'); const g = hex('#8CC152');
    s.cyl(hex('#EAF6EA'), 0, 0, 0, 5.2, 4.8, 0.9, 32); s.cyl(hex('#CFE8A8'), 0, 0.9, 0, 4.4, 4.2, 0.3, 32);
    // the World mark: a globe inside a ring
    s.at({ y: 1.2 + 3.6 }, () => { for (let i = 0; i < 28; i++) s.at({ rz: (i / 28) * 360 }, () => s.at({ y: 3.9 }, () => s.box(k, 0, -0.45, -0.5, 0.95, 0.95, 1.0))); });
    s.ball(w, 0, 1.2 + 0.9, 0, 2.7, 5.4, 24);
    s.at({ y: 1.2 + 3.6 }, () => { s.cyl(k, 0, -0.07, 0, 2.74, 2.74, 0.14, 28); s.cyl(g, 0, 0.9, 0, 2.55, 2.55, 0.12, 28); s.cyl(g, 0, -1.0, 0, 2.55, 2.55, 0.12, 28); });
  },
};
