'use client';
import { useEffect, useState } from 'react';

const ITEMS = [
  ['#steps', 'How it works'],
  ['#capture', 'Capture'],
  ['#real', 'On a phone'],
  ['#events', 'Events'],
  ['#proof', 'Proof'],
  ['#passport', 'Passport'],
  ['#organizers', 'Organizers'],
  ['#get', 'Get the app'],
];

// Collapsible header menu: a round button that opens a small card with the section links.
export default function NavMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);
  return (
    <div className="menu">
      <button className="menu-btn" aria-expanded={open} aria-controls="menu-list" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B0B0F" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
        </svg>
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <ul id="menu-list" className="menu-list">
            {ITEMS.map(([href, label]) => (
              <li key={href}><a href={href} onClick={() => setOpen(false)}>{label}</a></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
