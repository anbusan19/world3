'use client';
import { ICONS } from './ionicons-used';

// Web stand-in for @expo/vector-icons: draws the same Ionicons glyphs as a coloured mask.
export function Ionicons({ name, size = 24, color = '#000', style }) {
  const uri = ICONS[name] ?? ICONS[`${name}-outline`];
  if (!uri) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  const url = `url("${uri.replace(/"/g, "'")}")`;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', flex: 'none', width: size, height: size, backgroundColor: color,
        WebkitMaskImage: url, maskImage: url, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskPosition: 'center', maskPosition: 'center', ...style,
      }}
    />
  );
}
export default { Ionicons };
