import { useEffect, useRef, useState } from 'react';

// SIMULATED data. There is no backend yet, so the "live" feed is generated on the phone to show the design.
// Places are real landmarks; the traveler handles are made up and look like shortened wallet addresses.

export const HUB = { name: 'ETHGlobal Mumbai', lat: 19.0653, lng: 72.8697 }; // placeholder venue (BKC)

export const FEED_SPOTS = [
  { name: 'Gateway of India', city: 'Mumbai', lat: 18.922, lng: 72.8347, icon: 'business', theme: 'coral' },
  { name: 'Eiffel Tower', city: 'Paris', lat: 48.8584, lng: 2.2945, icon: 'triangle', theme: 'sky' },
  { name: 'Colosseum', city: 'Rome', lat: 41.8902, lng: 12.4922, icon: 'business', theme: 'sun' },
  { name: 'Taj Mahal', city: 'Agra', lat: 27.1751, lng: 78.0421, icon: 'home', theme: 'coral' },
  { name: 'Statue of Liberty', city: 'New York', lat: 40.6892, lng: -74.0445, icon: 'flame', theme: 'leaf' },
  { name: 'Sydney Opera House', city: 'Sydney', lat: -33.8568, lng: 151.2153, icon: 'boat', theme: 'ocean' },
  { name: 'Christ the Redeemer', city: 'Rio de Janeiro', lat: -22.9519, lng: -43.2105, icon: 'person', theme: 'leaf' },
  { name: 'Big Ben', city: 'London', lat: 51.5007, lng: -0.1246, icon: 'time', theme: 'sky' },
  { name: 'Tokyo Tower', city: 'Tokyo', lat: 35.6586, lng: 139.7454, icon: 'radio', theme: 'coral' },
  { name: 'Burj Khalifa', city: 'Dubai', lat: 25.1972, lng: 55.2744, icon: 'business', theme: 'sun' },
  { name: 'Table Mountain', city: 'Cape Town', lat: -33.9628, lng: 18.4098, icon: 'triangle', theme: 'leaf' },
  { name: 'Great Wall', city: 'Beijing', lat: 40.4319, lng: 116.5704, icon: 'git-branch', theme: 'sun' },
  { name: 'Chichen Itza', city: 'Yucatan', lat: 20.6843, lng: -88.5678, icon: 'grid', theme: 'coral' },
  { name: 'CN Tower', city: 'Toronto', lat: 43.6426, lng: -79.3871, icon: 'radio', theme: 'ocean' },
];

const HEX = '0123456789abcdef';
const rand = (n) => Math.floor(Math.random() * n);
const handle = () => {
  const h = (k) => Array.from({ length: k }, () => HEX[rand(16)]).join('');
  return `0x${h(3)}…${h(2)}`;
};

let nextId = 1;
function makeEvent() {
  const spot = FEED_SPOTS[rand(FEED_SPOTS.length)];
  return { id: nextId++, who: handle(), spot, at: Date.now() };
}

// Emits a fake capture every 2-4.5 s. onEvent (optional) is called for each one, e.g. to drive the globe.
export function useCaptureFeed(onEvent, { keep = 6 } = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    let timer;
    const tick = () => {
      const ev = makeEvent();
      setItems((prev) => [ev, ...prev].slice(0, keep));
      setTotal((n) => n + 1);
      cb.current?.(ev);
      timer = setTimeout(tick, 2000 + Math.random() * 2500);
    };
    timer = setTimeout(tick, 1200);
    return () => clearTimeout(timer);
  }, [keep]);

  return { items, total };
}

export function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 3) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}
