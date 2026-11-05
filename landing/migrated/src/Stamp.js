import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { F, STAMP_THEMES, makeStyles, useTheme } from './theme';
import { StampArt, hasArt } from './art/StampArt';

// The frame is ONE drawn outline with semicircular notches cut out of every edge (not separate dots laid on top).
// Everything scales with the stamp's width, so a small thumbnail and a full-screen stamp have the same notch
// proportions, the corners stay clean, and it works on any background (the notches are real gaps).
const NOTCH = 0.026; // notch radius as a fraction of the stamp width
const PITCH = 4.2; // distance between notch centres, in notch radii

function perforatedPath(w, h, r) {
  const nx = Math.max(4, Math.round(w / (r * PITCH)));
  const ny = Math.max(4, Math.round(h / (r * PITCH)));
  const px = w / nx;
  const py = h / ny;
  // Walk the outline clockwise. Every notch is an arc with sweep 0, which bulges inward on all four sides.
  // Notch centres sit half a step in from the corners, so the corners themselves are always solid.
  let d = 'M0 0';
  for (let i = 0; i < nx; i++) {
    const cx = (i + 0.5) * px;
    d += ` L${cx - r} 0 A${r} ${r} 0 0 0 ${cx + r} 0`;
  }
  d += ` L${w} 0`;
  for (let j = 0; j < ny; j++) {
    const cy = (j + 0.5) * py;
    d += ` L${w} ${cy - r} A${r} ${r} 0 0 0 ${w} ${cy + r}`;
  }
  d += ` L${w} ${h}`;
  for (let i = nx - 1; i >= 0; i--) {
    const cx = (i + 0.5) * px;
    d += ` L${cx + r} ${h} A${r} ${r} 0 0 0 ${cx - r} ${h}`;
  }
  d += ` L0 ${h}`;
  for (let j = ny - 1; j >= 0; j--) {
    const cy = (j + 0.5) * py;
    d += ` L0 ${cy + r} A${r} ${r} 0 0 0 0 ${cy - r}`;
  }
  return `${d} Z`;
}

// Just the notched outline, filled with one colour. The back face of the 3D stamp uses it.
export function StampOutline({ w, h, color }) {
  const r = Math.max(1.8, w * NOTCH);
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Path d={perforatedPath(w, h, r)} fill={color} />
    </Svg>
  );
}

// An illustrated postage stamp: perforated pastel frame around a scene (hand-drawn art when the spot has some,
// otherwise sky + sun + hills + icon), a bold label, and an optional number tag.
// `holes` and `holeColor` are accepted for older call sites but no longer needed.
export function Stamp({ theme = 'coral', art, icon, label, tag, locked, iconSize = 38, labelSize = 13, style }) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const t = STAMP_THEMES[theme] ?? STAMP_THEMES.coral;
  const [box, setBox] = useState(null);

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
  };

  const pad = box ? Math.max(4, box.w * 0.05) : 8;
  const r = box ? Math.max(1.8, box.w * NOTCH) : 0;

  return (
    <View onLayout={onLayout} style={[styles.stamp, { padding: pad }, locked && { opacity: isDark ? 0.8 : 0.55 }, style]}>
      {box ? (
        <Svg width={box.w} height={box.h} style={styles.frame} pointerEvents="none">
          <Path d={perforatedPath(box.w, box.h, r)} fill={t.frame} />
        </Svg>
      ) : (
        <View style={[styles.frame, { backgroundColor: t.frame }]} />
      )}

      <View style={[styles.scene, { backgroundColor: t.sky }]}>
        {hasArt(art) ? (
          <StampArt name={art} />
        ) : (
          <>
            <View style={styles.sun} />
            <View style={[styles.hill, styles.hillBack, { backgroundColor: t.hill }]} />
            <View style={[styles.hill, styles.hillFront, { backgroundColor: t.hill2 }]} />
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={iconSize} color={t.accent} />
            </View>
          </>
        )}
        {tag != null && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { fontSize: labelSize, color: t.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {label}
      </Text>

      {locked && (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  stamp: { aspectRatio: 0.82 },
  frame: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  scene: { flex: 1, borderRadius: 3, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FFFFFFB3' },
  sun: { position: 'absolute', top: '10%', right: '11%', width: '24%', aspectRatio: 1, borderRadius: 999, backgroundColor: C.orange },
  hill: { position: 'absolute', borderRadius: 999 },
  hillBack: { left: '-22%', bottom: '-36%', width: '92%', height: '66%' },
  hillFront: { right: '-26%', bottom: '-44%', width: '98%', height: '72%' },
  iconWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: '22%', alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', top: 5, left: 5, backgroundColor: '#0B0B0F', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontFamily: F.bold, fontSize: 8, color: '#fff', letterSpacing: 0.4 },
  label: { fontFamily: F.black, letterSpacing: 1.2, textAlign: 'center', marginTop: 5 },
  lock: { position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center' },
}));
