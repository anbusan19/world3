'use client';
import { useEffect, useRef } from 'react';

// An ordered-dither field in blue and green, in the style of the Nod landing page: a Bayer matrix decides which
// cells are drawn, so a smooth level turns into a crisp dot pattern. It pools in the hero's top-left corner,
// blue and green dots mixed at random, with a slow wave drifting through it.
const bayer = (() => {
  let m = [[0, 2], [3, 1]];
  for (let n = 2; n < 8; n *= 2) {
    const next = Array.from({ length: n * 2 }, () => new Array(n * 2));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = m[y][x] * 4;
      next[y][x] = v; next[y][x + n] = v + 2; next[y + n][x] = v + 3; next[y + n][x + n] = v + 1;
    }
    m = next;
  }
  return m.map((r) => r.map((v) => (v + 0.5) / 64));
})();
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function DitherField() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, cols = 0, rows = 0, cell = 14, raf = 0, visible = true;
    const size = () => {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = W < 700 ? 10 : 14;
      cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      const wave = (t / 11000) % 1;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const u = x / cols, v = y / rows; // 0..1, v grows downward
        // a pool in the top-left corner, thinning out toward the middle of the hero
        let level = 1.05 - Math.hypot(u * 4.4, v * 2.4);
        level += 0.14 * Math.max(0, 1 - Math.abs(u - (wave * 1.2 - 0.1)) / 0.12) * smooth(0.0, 0.3, level);
        if (level <= bayer[y & 7][x & 7]) continue;
        // blue and green mixed at random (the same cell always gets the same colour)
        const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        ctx.fillStyle = h - Math.floor(h) > 0.5 ? 'rgba(2,101,173,.55)' : 'rgba(166,209,108,.7)';
        const s = cell * 0.66;
        ctx.fillRect(x * cell + (cell - s) / 2, y * cell + (cell - s) / 2, s, s);
      }
    };
    const loop = (now) => { draw(now); raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0; };
    const kick = () => { if (!raf && !reduce) raf = requestAnimationFrame(loop); };
    size(); draw(0); kick();
    const ro = new ResizeObserver(() => { size(); draw(performance.now()); });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); });
    io.observe(cv);
    document.addEventListener('visibilitychange', kick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', kick); };
  }, []);
  return <canvas ref={ref} className="dither" aria-hidden="true" />;
}
