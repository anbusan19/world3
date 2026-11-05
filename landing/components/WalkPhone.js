'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { ThemeProvider } from '@/migrated/src/theme';
import { ArCamera } from '@/migrated/src/screens/ArCamera';
import { PhoneSizeContext } from '@/migrated/src/phoneSize';
import { Arch } from './Art';

// The app's real capture screen (ArCamera), driven by a distance. The landmark is drawn here because the web page
// has no AR model: it grows as you get closer, is dimmed and locked inside 100 m, and solid inside 20 m.
const SPOT = { id: '01', name: 'Gateway of India', label: 'GATEWAY', art: 'gateway', icon: 'business', theme: 'coral', kind: 'geospatial', captureM: 20, approachM: 100 };

function Scene({ d }) {
  const zone = d <= 20;
  const appr = d <= 100;
  const s = Math.max(0.2, Math.min(1.5, 26 / d));
  return (
    <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
      {!appr && (
        <g transform="translate(100 226)">
          <path d="M0 0c-9-10-9-24 0-24s9 14 0 24Z" fill="#F26B21" />
          <circle cx="0" cy="-15" r="3.4" fill="#fff" />
        </g>
      )}
      {appr && (
        <g transform={`translate(100 230) scale(${s * 1.5}) translate(-50 -94)`}>
          <Arch opacity={zone ? 1 : 0.55} />
        </g>
      )}
      {zone && <ellipse cx="100" cy="234" rx="84" ry="12" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="6 6" />}
    </svg>
  );
}

export default function WalkPhone({ d, label }) {
  const box = useRef(null);
  const [size, setSize] = useState({ width: 390, height: 780 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="phone" role="img" aria-label={label}>
      <div className="screen" ref={box}>
        <PhoneSizeContext.Provider value={size}>
          <ThemeProvider>
            <ArCamera spot={{ ...SPOT, dist: d }} user={{ accuracy: 3 }} onClose={() => {}} onCapture={() => {}} scene={<Scene d={d} />} />
          </ThemeProvider>
        </PhoneSizeContext.Provider>
      </div>
    </div>
  );
}
