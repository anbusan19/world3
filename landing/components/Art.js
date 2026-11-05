// The Gateway of India scene used on the phone and the Gateway stamp. Drawn in a 100 x 100 box, base at y = 94.
export function Arch({ opacity = 1 }) {
  return (
    <g opacity={opacity}>
      <ellipse cx="50" cy="94" rx="44" ry="3.2" fill="#00000040" />
      <rect x="20" y="52" width="60" height="42" fill="#C9985A" />
      <rect x="20" y="52" width="60" height="6" fill="#B07A3E" />
      <path d="M38 94V72a12 12 0 0 1 24 0V94Z" fill="#2B1B10" />
      <path d="M40 94V73a10 10 0 0 1 20 0V94Z" fill="#7BB6D4" />
      <rect x="12" y="44" width="16" height="50" fill="#D6A768" />
      <rect x="72" y="44" width="16" height="50" fill="#D6A768" />
      <path d="M12 44a8 8 0 0 1 16 0Z" fill="#B07A3E" />
      <path d="M72 44a8 8 0 0 1 16 0Z" fill="#B07A3E" />
      <path d="M32 52a18 18 0 0 1 36 0Z" fill="#B07A3E" />
      <path d="M42 40a8 8 0 0 1 16 0Z" fill="#8C5F2B" />
      <rect x="49" y="28" width="2" height="12" fill="#8C5F2B" />
      <g fill="#8C5F2B">
        <rect x="16" y="56" width="3" height="12" rx="1.5" />
        <rect x="21" y="56" width="3" height="12" rx="1.5" />
        <rect x="76" y="56" width="3" height="12" rx="1.5" />
        <rect x="81" y="56" width="3" height="12" rx="1.5" />
      </g>
    </g>
  );
}
