import { StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Circle, Defs, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from '../Stamp';
import { F, makeStyles, useColors } from '../theme';

// Hero illustrations for the onboarding slides that are not stamps: the app's map card + a flat globe (slide 1) and a
// passport (slide 3). Everything is flat colour on purpose: no gradients, no shading.

/* ----------------------------- slide 1: map + globe ---------------------------- */

// The map interior uses the same palette as the real cartoon map in the app.
function MapArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
      <Rect width="200" height="200" fill="#D8EDB0" />
      {/* sea with a lighter shallow band */}
      <Path d="M200 52 C172 66 150 98 160 128 C168 154 146 180 124 200 L200 200 Z" fill="#4DAED6" />
      <Path d="M200 68 C182 80 168 104 176 130 C182 152 166 176 150 200 L200 200 Z" fill="#0265AD" />
      {/* parks */}
      <Rect x="14" y="18" width="46" height="32" rx="10" fill="#A6D16C" />
      <Circle cx="58" cy="158" r="22" fill="#A6D16C" />
      <Rect x="98" y="150" width="28" height="22" rx="8" fill="#A6D16C" />
      {/* blocks */}
      <G fill="#F9C9B0">
        <Rect x="74" y="30" width="16" height="14" rx="3" />
        <Rect x="96" y="30" width="22" height="14" rx="3" />
        <Rect x="124" y="30" width="16" height="14" rx="3" />
        <Rect x="74" y="54" width="16" height="12" rx="3" />
        <Rect x="14" y="108" width="20" height="14" rx="3" />
        <Rect x="40" y="108" width="14" height="14" rx="3" />
        <Rect x="124" y="62" width="14" height="12" rx="3" />
      </G>
      {/* streets */}
      <G stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none">
        <Path d="M0 84 L150 84" />
        <Path d="M66 0 L66 200" />
        <Path d="M0 130 L128 112" />
        <Path d="M112 0 L122 90" />
      </G>
      {/* highway along the coast */}
      <Path d="M150 0 C146 40 140 70 146 100 C152 128 138 160 120 200" stroke="#E0B93A" strokeWidth="11" fill="none" strokeLinecap="round" />
      <Path d="M150 0 C146 40 140 70 146 100 C152 128 138 160 120 200" stroke="#F6E27A" strokeWidth="7" fill="none" strokeLinecap="round" />
      {/* route between the two spots */}
      <Path d="M52 70 Q96 40 118 118" stroke="#F26B21" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeDasharray="1 7" />
    </Svg>
  );
}

function GlobeArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="hgClip">
          <Circle cx="50" cy="50" r="50" />
        </ClipPath>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="#0265AD" />
      <G clipPath="url(#hgClip)" fill="#A6D16C">
        <Path d="M30 22 C48 10 76 14 88 32 C94 46 86 56 72 56 C62 60 54 50 44 52 C34 48 22 36 30 22 Z" />
        <Path d="M50 54 C60 56 66 62 64 72 C62 80 58 86 56 90 C51 84 47 74 47 64 C47 58 48 55 50 54 Z" />
        <Path d="M6 44 C18 36 30 44 32 56 C32 68 26 76 18 86 C8 84 2 72 2 60 Z" />
        <Path d="M68 78 C80 72 94 78 94 88 C86 96 72 94 66 86 Z" />
      </G>
      <Circle cx="58" cy="56" r="5.5" fill="#F26B21" stroke="#FFFFFF" strokeWidth="2.5" />
    </Svg>
  );
}

function SpotPin({ left, top, size, bg, icon, selected }) {
  const styles = useStyles();
  const C = useColors();
  return (
    <View
      style={[
        styles.pin,
        { left, top, width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2, backgroundColor: bg },
        selected && { borderColor: '#0B0B0F' },
      ]}
    >
      <Ionicons name={icon} size={size * 0.48} color={C.orange} />
    </View>
  );
}

export function MapHero() {
  const styles = useStyles();
  const C = useColors();
  return (
    <View style={styles.square}>
      <View style={styles.tile} />

      {/* the app's map card */}
      <View style={styles.mapCard}>
        <MapArt />
      </View>
      <View style={styles.mapRing} pointerEvents="none">
        <SpotPin left="26%" top="34%" size={36} bg={C.peach} icon="business" />
        <SpotPin left="64%" top="58%" size={46} bg={C.sun} icon="train" selected />
        <View style={[styles.you, { left: '36%', top: '76%' }]}>
          <View style={styles.youCore} />
        </View>
      </View>

      {/* chips, same as the real map */}
      <View style={styles.gps}>
        <View style={styles.gpsDot} />
        <Text style={styles.gpsText}>GPS on</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.infoName}>Gateway of India</Text>
        <Text style={styles.infoMeta}>1.2 km away</Text>
      </View>

      {/* flat globe */}
      <View style={styles.globeWrap}>
        <GlobeArt />
      </View>

      <View style={styles.navBadge}>
        <Ionicons name="navigate" size={20} color="#0B0B0F" />
      </View>
      <View style={[styles.spark, { backgroundColor: C.orange, right: '6%', top: '44%' }]} />
      <View style={[styles.spark, { backgroundColor: C.blue, left: '2%', top: '8%', width: 9, height: 9 }]} />
    </View>
  );
}

/* ------------------------------- slide 3: passport ----------------------------- */

const COVER = '#9AD5E6'; // pastel sky
const COVER_DARK = '#6DBAD1';
const INK_BLUE = '#0B4F86';

// leaves along a circular arc, used for the laurel wreath on the cover
function laurel(cx, cy, r, from, to, n, key) {
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    const rot = (a * 180) / Math.PI + 90 + (to > from ? 25 : -25);
    leaves.push(<Ellipse key={`${key}${i}`} cx={x} cy={y} rx="3.2" ry="6.6" fill="#FFFFFF" transform={`rotate(${rot} ${x} ${y})`} />);
  }
  return leaves;
}

function PassportSvg() {
  const C = useColors();
  return (
    <Svg width="100%" height="100%" viewBox="-14 -10 328 322" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <ClipPath id="pvDisc">
          <Circle cx="141" cy="196" r="24" />
        </ClipPath>
      </Defs>

      {/* flat pastel shapes behind */}
      <Circle cx="140" cy="186" r="104" fill="#FBE7A6" />
      <Circle cx="238" cy="244" r="50" fill={C.peach} />
      <Circle cx="38" cy="84" r="26" fill="#CDE7B0" />

      <G transform="rotate(-5 145 185)">
        {/* flat offset shadow */}
        <Rect x="66" y="86" width="162" height="216" rx="12" fill="#0B0B0F" opacity="0.1" />

        {/* page block on the right */}
        <Rect x="212" y="84" width="22" height="206" rx="5" fill="#FFF6E8" />
        <G stroke="#F0DDC0" strokeWidth="1">
          {[96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276].map((y) => (
            <Line key={y} x1="214" y1={y} x2="233" y2={y} />
          ))}
        </G>
        <Rect x="228" y="84" width="8" height="206" rx="4" fill="#F9A98B" />

        {/* bookmark ribbon */}
        <Path d="M214 286 H226 V306 L220 300 L214 306 Z" fill={C.orange} />

        {/* cover */}
        <Rect x="58" y="76" width="162" height="216" rx="12" fill={COVER} />
        <Rect x="58" y="76" width="14" height="216" rx="8" fill={COVER_DARK} />
        <Rect x="70" y="88" width="138" height="192" rx="8" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeDasharray="3 3.5" />

        {/* title */}
        <SvgText x="141" y="124" fill={INK_BLUE} fontSize="18" fontFamily={F.black} fontWeight="bold" textAnchor="middle" letterSpacing="2">
          WORLD3
        </SvgText>
        <SvgText x="141" y="143" fill={INK_BLUE} fontSize="11" fontFamily={F.bold} fontWeight="bold" textAnchor="middle" letterSpacing="3.5">
          PASSPORT
        </SvgText>

        {/* globe emblem inside a laurel wreath */}
        {laurel(141, 196, 41, 118, 252, 8, 'l')}
        {laurel(141, 196, 41, 62, -72, 8, 'r')}
        <Circle cx="141" cy="196" r="24" fill="#0265AD" />
        <G clipPath="url(#pvDisc)">
          <Path d="M128 182 C138 176 152 180 156 190 C152 196 142 194 136 198 C128 196 124 188 128 182 Z" fill="#A6D16C" />
          <Path d="M138 204 C146 202 152 208 148 216 C142 218 136 212 138 204 Z" fill="#A6D16C" />
        </G>
        <Circle cx="141" cy="196" r="24" fill="none" stroke="#FFFFFF" strokeWidth="2" />

        {/* chip symbol */}
        <Rect x="125" y="250" width="32" height="20" rx="5" fill="none" stroke={INK_BLUE} strokeWidth="2" />
        <Circle cx="141" cy="260" r="4.6" fill={INK_BLUE} />
      </G>

      {/* postmark */}
      <G>
        <Circle cx="224" cy="262" r="27" fill="none" stroke="#F26B21" strokeWidth="2.6" />
        <Circle cx="224" cy="262" r="19" fill="none" stroke="#F26B21" strokeWidth="1.8" strokeDasharray="2 3" />
        <Path d="M248 250 q8 -5 16 0 t16 0" stroke="#F26B21" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Path d="M250 262 q8 -5 16 0 t16 0" stroke="#F26B21" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Path d="M248 274 q8 -5 16 0 t16 0" stroke="#F26B21" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </G>
    </Svg>
  );
}

export function PassportHero({ badges = true }) {
  const styles = useStyles();
  const C = useColors();
  return (
    <View style={styles.passportBox}>
      {/* two stamps peeking out from behind the cover */}
      <Stamp theme="coral" art="gateway" label="GATEWAY" labelSize={9} holes={8} style={[styles.peek, { left: '19%', top: '3%', transform: [{ rotate: '-11deg' }] }]} />
      <Stamp theme="sun" art="csmt" label="CSMT" labelSize={9} holes={8} style={[styles.peek, { left: '45%', top: '1%', transform: [{ rotate: '9deg' }] }]} />
      <View style={StyleSheet.absoluteFill}>
        <PassportSvg />
      </View>
      {badges && (
        <>
          <View style={[styles.badge, { backgroundColor: C.green, left: '2%', top: '60%' }]}>
            <Ionicons name="checkmark" size={20} color="#0B0B0F" />
          </View>
          <View style={[styles.badge, { backgroundColor: C.orange, right: '3%', top: '16%' }]}>
            <Ionicons name="star" size={19} color="#fff" />
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  // slide 1
  square: { width: '94%', aspectRatio: 1, alignSelf: 'center' },
  tile: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.sky, borderRadius: 44, transform: [{ rotate: '-6deg' }, { scale: 0.96 }] },
  mapCard: { position: 'absolute', left: '7%', top: '17%', width: '70%', height: '70%', borderRadius: 26, overflow: 'hidden', borderWidth: 4, borderColor: '#fff', transform: [{ rotate: '3deg' }] },
  mapRing: { position: 'absolute', left: '7%', top: '17%', width: '70%', height: '70%', transform: [{ rotate: '3deg' }] },
  pin: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  you: { position: 'absolute', width: 26, height: 26, borderRadius: 13, marginLeft: -13, marginTop: -13, backgroundColor: '#0265AD55', alignItems: 'center', justifyContent: 'center' },
  youCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 4, borderColor: '#0265AD' },
  gps: { position: 'absolute', left: '2%', top: '9%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 12, height: 30, borderRadius: 15 },
  gpsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  gpsText: { fontFamily: F.bold, fontSize: 11, color: '#0B0B0F' },
  info: { position: 'absolute', left: '0%', bottom: '5%', backgroundColor: '#0B0B0F', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  infoName: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  infoMeta: { fontFamily: F.med, fontSize: 11, color: C.green, marginTop: 2 },
  globeWrap: { position: 'absolute', right: '0%', top: '2%', width: '36%', aspectRatio: 1, borderRadius: 999, borderWidth: 5, borderColor: '#fff', backgroundColor: '#fff', overflow: 'hidden' },
  navBadge: { position: 'absolute', right: '8%', bottom: '8%', width: 46, height: 46, borderRadius: 23, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  spark: { position: 'absolute', width: 11, height: 11, borderRadius: 6 },

  // slide 3
  passportBox: { height: '84%', aspectRatio: 1, alignSelf: 'center', marginTop: '3%' },
  peek: { position: 'absolute', width: '31%' },
  badge: { position: 'absolute', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg },
}));
