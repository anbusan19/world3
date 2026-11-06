// Small flat shapes that drift slowly behind the content, like confetti. Decorative only.
export function Squiggle({ className = '', color = '#F6E27A', w = 90 }) {
  return (
    <svg className={`squig ${className}`} width={w} viewBox="0 0 90 120" fill="none" aria-hidden="true">
      <path d="M20 8c30 6 40 14 18 26S6 52 36 62s30 24 6 36" stroke={color} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Blob({ className = '', color = '#F9C9B0', w = 70 }) {
  return (
    <svg className={`squig ${className}`} width={w} viewBox="0 0 70 70" aria-hidden="true">
      <path d="M36 4c18-2 32 14 28 32S46 68 28 64 2 46 6 28 20 6 36 4z" fill={color} />
    </svg>
  );
}
export function Dot({ className = '', color = '#0265AD', size = 18 }) {
  return <span className={`squig dotx ${className}`} style={{ width: size, height: size, background: color }} aria-hidden="true" />;
}
