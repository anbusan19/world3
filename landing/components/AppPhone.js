'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import App from '@/migrated/App';
import { PhoneSizeContext } from '@/migrated/src/phoneSize';

// The real app screens, running in a phone frame. startPhase: 'app' opens on the tabs, 'onboarding' starts from launch.
export default function AppPhone({ startPhase = 'app', label }) {
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
    <div className="phone" role="group" aria-label={label}>
      <div className="screen" ref={box}>
        <PhoneSizeContext.Provider value={size}>
          <App startPhase={startPhase} />
        </PhoneSizeContext.Provider>
      </div>
    </div>
  );
}
