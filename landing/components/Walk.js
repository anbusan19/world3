'use client';
import { useState } from 'react';
import { WalkPhone } from './Rn';

const CAP = 20;
const APPR = 100;
const STATES = [
  { key: 'far', name: 'Far', text: 'A map pin and a direction arrow. No model yet.' },
  { key: 'approach', name: 'Approaching', text: 'The model fades in, dimmed and locked, and grows as you walk.' },
  { key: 'zone', name: 'Capture zone', text: 'Solid and tappable. Capture is enabled.' },
];

export function Walk() {
  const [d, setD] = useState(60);
  const now = d <= CAP ? 'zone' : d <= APPR ? 'approach' : 'far';
  const pos = (m) => `${((m - 6) / (150 - 6)) * 100}%`;
  return (
    <div className="split">
      <div>
        <p className="eyebrow">The capture zone</p>
        <h2 style={{ marginTop: 14 }}>Drag to walk toward the landmark.</h2>
        <p className="lede" style={{ marginTop: 18 }}>The model is pinned to its real coordinate. From a distance you only get a direction. Inside 100 m it appears, locked. Inside 20 m it is solid and the capture button unlocks.</p>
        <div className="slide">
          <label htmlFor="dist"><span>Your distance</span><output>{d} m</output></label>
          <input id="dist" type="range" min="6" max="150" step="1" value={d} onChange={(e) => setD(+e.target.value)} />
          <div className="ticks" aria-hidden="true">
            <span style={{ left: pos(CAP) }}>20 m</span>
            <span style={{ left: pos(APPR) }}>100 m</span>
          </div>
        </div>
        <div className="states">
          {STATES.map((s) => (
            <div key={s.key} className={`state${now === s.key ? ' on' : ''}`}><b>{s.name}</b><span>{s.text}</span></div>
          ))}
        </div>
      </div>
      <div className="phone-wrap">
        <div className="tile alt" />
        <WalkPhone d={d} label="The app's capture screen, driven by the distance slider" />
      </div>
    </div>
  );
}
