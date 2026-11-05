'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { globeStyle } from '@/migrated/src/mapStyle';

// The app's cartoon globe (same MapLibre style as the Globe tab), slowly turning. It sits in the hero's bottom-right
// corner and only its upper-left part shows, so it looks like it is rising over the horizon.

export default function HeroGlobe() {
  const box = useRef(null);
  const wrap = useRef(null);
  const sea = useRef(null);
  useEffect(() => {
    const el = box.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = new maplibregl.Map({
      container: el, style: globeStyle, center: [20, 18], zoom: 2, interactive: false, attributionControl: false,
      pitchWithRotate: false, pixelRatio: Math.max(window.devicePixelRatio || 1, 2), dragRotate: false, maxPitch: 0, fadeDuration: 0,
    });
    // zoom so the globe's diameter matches the box (globe diameter = 512 * 2^zoom / pi)
    const fit = () => { map.resize(); map.setZoom(Math.log2((el.clientWidth * 0.98 * Math.PI) / 512)); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    let raf = 0;
    let last = performance.now();
    let lng = 20;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (visible && !reduce && !document.hidden) {
        lng = ((((lng + 6 * dt + 180) % 360) + 360) % 360) - 180;
        map.jumpTo({ center: [lng, 18] });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); map.remove(); };
  }, []);
  // scrolling through the hero grows the globe until it fills the screen, then the ocean-blue overlay takes over
  useEffect(() => {
    const globe = wrap.current;
    const hero = globe.parentElement;
    const track = hero.parentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const span = track.offsetHeight - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -track.getBoundingClientRect().top / span)) : 0;
      const W = hero.clientWidth;
      const H = hero.clientHeight;
      const R = globe.offsetWidth * 0.49;
      const cx = globe.offsetLeft + globe.offsetWidth / 2;
      const cy = globe.offsetTop + globe.offsetHeight / 2;
      const end = (Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) / R) * 1.04;
      const g = Math.min(1, p / 0.8);
      const e = g * g * (3 - 2 * g);
      globe.style.transform = `scale(${1 + (end - 1) * e})`;
      const f = Math.min(1, Math.max(0, (p - 0.62) / 0.3));
      sea.current.style.opacity = String(f * f * (3 - 2 * f));
      track.style.setProperty('--p', p.toFixed(3));
      document.documentElement.style.setProperty('--p', p.toFixed(3));
      track.dataset.dark = p > 0.6 ? 'true' : 'false';
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div className="globe" aria-hidden="true" ref={wrap}>
        <div className="globe-map" ref={box} />
      </div>
      <div className="globe-sea" aria-hidden="true" ref={sea} />
    </>
  );
}
