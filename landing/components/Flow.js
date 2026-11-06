'use client';
import { useEffect, useRef } from 'react';

// A soft green ribbon that weaves down the whole page from the hero to the footer and draws itself as you scroll.
// It is one SVG path laid over the page (it ignores clicks and is multiplied into what is under it, so text stays readable).
// The path is rebuilt whenever the page height or width changes.

const GREEN = ['#CFE8A8', '#A6D16C', '#8CC152'];

function build(w, h) {
  const narrow = w < 900;
  const left = narrow ? w * 0.08 : w * 0.06;
  const right = narrow ? w * 0.92 : w * 0.94;
  const step = Math.max(720, Math.min(1200, h / 9)); // vertical distance between swings
  let y = Math.min(h * 0.08, 800);
  let x = right;
  let d = `M${w * 0.62} ${y * 0.4} C${w * 0.8} ${y * 0.7} ${x} ${y * 0.7} ${x} ${y}`;
  let side = 0; // 0: just arrived on the right
  while (y + step < h - 420) {
    const nx = side === 0 ? left : right;
    const ny = y + step;
    d += ` C${x} ${y + step * 0.55} ${nx} ${ny - step * 0.55} ${nx} ${ny}`;
    x = nx; y = ny; side ^= 1;
  }
  // settle toward the middle of the footer
  d += ` C${x} ${y + 260} ${w * 0.5} ${y + 200} ${w * 0.5} ${h - 160}`;
  return d;
}

export default function Flow() {
  const svg = useRef(null);
  const main = useRef(null);
  const glow = useRef(null);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let len = 1;
    let raf = 0;
    const draw = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight;
      const p = Math.min(1, Math.max(0, (window.scrollY + window.innerHeight * 0.75) / h));
      const shown = reduce ? 1 : Math.min(1, p * 1.04);
      for (const el of [main.current, glow.current]) {
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len * (1 - shown));
      }
    };
    const layout = () => {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.scrollHeight;
      svg.current.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.current.style.height = h + 'px';
      const d = build(w, h);
      main.current.setAttribute('d', d);
      glow.current.setAttribute('d', d);
      main.current.style.strokeWidth = w < 900 ? '34' : '64';
      glow.current.style.strokeWidth = w < 900 ? '64' : '120';
      len = main.current.getTotalLength();
      draw();
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(draw); };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(document.body);
    window.addEventListener('scroll', on, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <svg className="flow" ref={svg} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="flow-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100%">
          <stop offset="0" stopColor={GREEN[0]} />
          <stop offset="0.5" stopColor={GREEN[1]} />
          <stop offset="1" stopColor={GREEN[2]} />
        </linearGradient>
      </defs>
      <path ref={glow} className="flow-glow" fill="none" stroke="url(#flow-g)" strokeLinecap="round" />
      <path ref={main} className="flow-main" fill="none" stroke="url(#flow-g)" strokeLinecap="round" />
    </svg>
  );
}
