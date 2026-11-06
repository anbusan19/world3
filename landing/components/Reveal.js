'use client';
import { useEffect } from 'react';

// Fades and lifts elements with class "reveal" into place as they scroll into view. Without JavaScript, or with reduced motion,
// everything is simply visible (the CSS only hides .reveal when html has the "js" class).
export default function Reveal() {
  useEffect(() => {
    const items = [...document.querySelectorAll('.reveal')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((e) => e.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return null;
}
