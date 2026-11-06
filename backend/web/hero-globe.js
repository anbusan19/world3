// The app's own Globe-tab map (same MapLibre style, same projection), slowly turning in the corner of the green tiles.
// maplibre-gl 5 is loaded from a CDN when the page has a tile; the style is the app's `globeStyle`, bundled from src/.
import { globeStyle } from '../../src/mapStyle.js';

const VERSION = '5.24.0';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function load() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.css`; document.head.append(css);
    const js = document.createElement('script'); js.src = `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.js`;
    js.onload = () => resolve(window.maplibregl); js.onerror = reject; document.head.append(js);
  });
}

function mount(tile, maplibregl) {
  const box = document.createElement('div');
  box.className = 'hero-globe'; box.setAttribute('aria-hidden', 'true');
  tile.prepend(box);
  const map = new maplibregl.Map({
    container: box, style: globeStyle, center: [60, 18], zoom: 2, interactive: false, attributionControl: false,
    pitchWithRotate: false, dragRotate: false, maxPitch: 0, fadeDuration: 0, pixelRatio: Math.max(devicePixelRatio || 1, 2),
  });
  const fit = () => { map.resize(); map.setZoom(Math.log2((box.clientWidth * 0.98 * Math.PI) / 512)); };
  fit();
  new ResizeObserver(fit).observe(box);
  let lng = 60; let last = performance.now(); let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (visible && !reduce && !document.hidden) { lng = ((((lng + 6 * dt + 180) % 360) + 360) % 360) - 180; map.jumpTo({ center: [lng, 18] }); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const tiles = [...document.querySelectorAll('main > .hero, main .intro')];
if (tiles.length) load().then((m) => tiles.forEach((t) => mount(t, m))).catch(() => { /* the tile simply has no globe */ });
