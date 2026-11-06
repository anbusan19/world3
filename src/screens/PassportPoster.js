import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from '../Stamp';
import { F, makeStyles, useColors } from '../theme';
import { spots } from '../spots';

// The Mumbai Passport: a stamp-trail poster for the Aqua Line (Cuffe Parade to Marol Naka). The card sits at the top
// of the Stamps page and shows how far along you are; opening it shows the whole poster with every station's stamp.
// Our own design, in the spirit of the printed passports that metro systems hand out at their ticket counters.

const INK = '#0B2A55';
const TEAL = '#14A0B0';
const AQUA = '#CDEEF1';
const PAPER = '#F7F2E7';
const RED = '#C8352B';

// one icon per station, in line order
const ICONS = { 'Cuffe Parade': 'business', Churchgate: 'train', 'Hutatma Chowk': 'flag', 'CSMT Metro': 'subway', Worli: 'boat', Siddhivinayak: 'flower', Dharavi: 'home', 'Bandra Kurla Complex': 'briefcase', 'CSMIA Terminal 2': 'airplane', 'Marol Naka': 'location' };

export const stationsOf = (list = spots) => list.filter((s) => s.eventId === 'aqualine' && s.kind !== 'quest');
export const finaleOf = (list = spots) => list.find((s) => s.eventId === 'aqualine' && s.kind === 'quest');
const SHORT = { 'Cuffe Parade': 'Cuffe', 'Hutatma Chowk': 'Hutatma', 'CSMT Metro': 'CSMT', 'Bandra Kurla Complex': 'BKC', 'CSMIA Terminal 2': 'T2', 'Marol Naka': 'Marol' };
const stationName = (s) => s.name.replace(/^Aqua Line · /, '');

// ---- the illustration: skyline over the sea, a metro train on a viaduct ----
export function TrailArt({ width }) {
  const h = width * 0.42;
  return (
    <Svg width={width} height={h} viewBox="0 0 320 134">
      <Defs>
        <LinearGradient id="pSky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#BFE6F0" /><Stop offset="1" stopColor="#F2F8F6" /></LinearGradient>
      </Defs>
      <Rect width="320" height="134" fill="url(#pSky)" />
      <Circle cx="268" cy="30" r="15" fill="#FFD9A8" />
      {/* skyline: towers of the south of the city */}
      <G fill="#8FB9D6" opacity="0.7">
        <Rect x="14" y="52" width="18" height="48" /><Rect x="36" y="38" width="14" height="62" /><Rect x="54" y="60" width="20" height="40" />
        <Rect x="84" y="30" width="12" height="70" /><Rect x="100" y="48" width="16" height="52" /><Rect x="124" y="22" width="14" height="78" />
        <Rect x="142" y="44" width="18" height="56" /><Rect x="168" y="58" width="22" height="42" /><Rect x="196" y="34" width="12" height="66" />
        <Rect x="212" y="50" width="18" height="50" /><Rect x="238" y="40" width="14" height="60" /><Rect x="258" y="62" width="24" height="38" />
      </G>
      <G fill="#5F93BC">
        <Rect x="24" y="64" width="16" height="36" /><Rect x="66" y="48" width="14" height="52" /><Rect x="108" y="58" width="20" height="42" />
        <Rect x="176" y="46" width="14" height="54" /><Rect x="222" y="62" width="18" height="38" /><Rect x="270" y="54" width="14" height="46" />
      </G>
      {/* sea */}
      <Rect y="100" width="320" height="34" fill="#1B86B5" />
      <Path d="M8 112 q8 -4 16 0 t16 0 M120 120 q8 -4 16 0 t16 0 M236 110 q8 -4 16 0 t16 0" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.5" strokeLinecap="round" />
      {/* viaduct */}
      <Rect x="0" y="92" width="320" height="6" fill="#7A8CA3" />
      {[24, 84, 144, 204, 264].map((x) => <Rect key={x} x={x} y="98" width="8" height="36" fill="#8FA0B5" />)}
      {/* the train: three cars, aqua stripe, big windows */}
      {[0, 1, 2].map((i) => (
        <G key={i} transform={`translate(${28 + i * 92} 56)`}>
          <Rect width="88" height="36" rx={i === 2 ? 14 : 5} fill="#FFFFFF" />
          <Rect y="22" width="88" height="7" fill={TEAL} />
          <Rect x="6" y="7" width="14" height="12" rx="2" fill={INK} /><Rect x="26" y="7" width="14" height="12" rx="2" fill={INK} />
          <Rect x="46" y="7" width="14" height="12" rx="2" fill={INK} />
          {i === 2 ? <Path d="M66 7 h12 q6 0 8 10 v2 h-20 z" fill={INK} /> : <Rect x="66" y="7" width="14" height="12" rx="2" fill={INK} />}
          <Circle cx="14" cy="33" r="3" fill={INK} /><Circle cx="74" cy="33" r="3" fill={INK} />
        </G>
      ))}
    </Svg>
  );
}

// ---- one round rubber stamp in the passport ----
export function RoundStamp({ station, got, size = 58, index }) {
  const rot = ((index * 37) % 17) - 8; // each stamp lands a little crooked, like a real one
  const color = got ? (index % 3 === 0 ? INK : index % 3 === 1 ? TEAL : RED) : '#9DB0C2';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${got ? rot : 0}deg` }] }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: got ? 2.5 : 1.5, borderColor: color, borderStyle: got ? 'solid' : 'dashed', opacity: got ? 1 : 0.7 }} />
      <View style={{ position: 'absolute', width: size - 9, height: size - 9, borderRadius: size / 2, borderWidth: 1, borderColor: color, opacity: got ? 0.7 : 0 }} />
      <Ionicons name={got ? (ICONS[stationName(station)] ?? 'location') : 'lock-closed'} size={size * 0.3} color={color} style={{ opacity: got ? 1 : 0.6 }} />
      <Text style={{ fontFamily: F.bold, fontSize: size * 0.135, color, marginTop: 1, textAlign: 'center', width: size - 12, opacity: got ? 1 : 0.7 }} numberOfLines={1} adjustsFontSizeToFit>
        {got ? (SHORT[stationName(station)] ?? stationName(station).split(' ')[0]).toUpperCase() : String(index + 1)}
      </Text>
    </View>
  );
}

// the open passport: two pages of five round stamps
function OpenPassport({ stations, collected, width, onOpen }) {
  const styles = useStyles();
  const slot = Math.floor((width / 2 - 14) / 3);
  const page = (items, offset) => (
    <View style={styles.page}>
      <View style={styles.pageRow}>
        {items.map((s, i) => (
          <Pressable key={s.id} onPress={() => onOpen?.(s)} style={{ width: slot, alignItems: 'center', paddingVertical: 6 }} accessibilityLabel={stationName(s)}>
            <RoundStamp station={s} got={collected[s.id] != null} size={slot - 8} index={offset + i} />
          </Pressable>
        ))}
      </View>
    </View>
  );
  return (
    <View style={styles.book}>
      <View style={styles.spine} />
      {page(stations.slice(0, 5), 0)}
      {page(stations.slice(5, 10), 5)}
    </View>
  );
}

// ---- the compact card on the Stamps page ----
export function PassportCard({ collected, onOpen }) {
  const styles = useStyles();
  const stations = stationsOf();
  const { width } = useWindowDimensions();
  if (!stations.length) return null;
  const have = stations.filter((s) => collected[s.id] != null).length;
  const w = Math.min(width - 40, 440);
  return (
    <Pressable onPress={onOpen} style={styles.card} accessibilityRole="button" accessibilityLabel="Open the Mumbai Passport">
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>MUMBAI PASSPORT · AQUA LINE</Text>
          <Text style={styles.cardTitle}>Stamp Trail</Text>
          <Text style={styles.cardSub}>{have} of {stations.length} stations stamped</Text>
        </View>
        <View style={styles.cardArrow}><Ionicons name="arrow-forward" size={16} color="#fff" /></View>
      </View>
      <TrailArt width={w - 24} />
      <View style={styles.bar}><View style={[styles.barFill, { width: `${(have / stations.length) * 100}%` }]} /></View>
    </Pressable>
  );
}

// ---- the whole poster, with every station's stamp ----
export function PassportScreen({ collected, onBack, openSpot, openStamp }) {
  const styles = useStyles();
  const C = useColors();
  const stations = stationsOf();
  const finale = finaleOf();
  const { width } = useWindowDimensions();
  const w = Math.min(width - 40, 440);
  const have = stations.filter((s) => collected[s.id] != null).length;
  const open = (s) => (collected[s.id] != null ? openStamp(s) : openSpot(s));
  return (
    <>
      <Pressable onPress={onBack} style={styles.back} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={C.ink} /><Text style={styles.backText}>Stamps</Text>
      </Pressable>

      <View style={[styles.poster, { width: w }]}>
        <View style={styles.pTop}>
          <Text style={styles.kicker}>MUMBAI PASSPORT</Text>
          <Text style={styles.pLine}>AQUA LINE</Text>
        </View>
        <Text style={styles.pTitle}>Stamp Trail</Text>
        <View style={styles.pUnderline} />
        <Text style={styles.pTag}>Ride the line. Get the stamps.</Text>
        <View style={styles.pill}><Text style={styles.pillText}>{stations.length} STATIONS · {stations.length} STAMPS</Text></View>

        <TrailArt width={w - 24} />

        <Text style={styles.pHead}>Your passport</Text>
        <OpenPassport stations={stations} collected={collected} width={w - 24} onOpen={open} />
        <Text style={styles.progress}>{have} of {stations.length} stamped{have === stations.length ? ' · trail complete' : ''}</Text>

        <Text style={styles.names}>{stations.map(stationName).join(' · ')}</Text>

        <Text style={styles.pHead}>The journey</Text>
        <View style={styles.steps}>
          {[['walk', 'Reach a station', 'Pick any of the ten on the Aqua Line.'], ['camera', 'Prove you are there', 'Open the camera at the station to check in.'], ['ribbon', 'Keep the stamp', 'It lands in your passport. All ten earn the finale.']].map(([ic, t, d]) => (
            <View key={t} style={styles.step}>
              <View style={styles.stepIcon}><Ionicons name={ic} size={20} color={TEAL} /></View>
              <Text style={styles.stepTitle}>{t}</Text>
              <Text style={styles.stepText}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.foot}><Text style={styles.footText}>10 stations. 10 stamps. One journey.</Text></View>
      </View>

      <Text style={styles.h2}>Every station</Text>
      <View style={styles.grid}>
        {stations.map((s) => {
          const got = collected[s.id] != null;
          return (
            <Pressable key={s.id} style={styles.cell} onPress={() => open(s)}>
              <Stamp theme={s.theme} art={s.art} icon={s.icon} label={(SHORT[stationName(s)] ?? stationName(s).split(' ')[0]).toUpperCase()} tag={s.id} locked={!got} iconSize={46} labelSize={14} holes={10} />
              <View style={styles.meta}>
                <Text style={styles.cellName} numberOfLines={1}>{stationName(s)}</Text>
                <Text style={styles.cellCount}>{got ? '1/1' : '0/1'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {finale ? (
        <Pressable style={styles.finale} onPress={() => open(finale)}>
          <Ionicons name={collected[finale.id] != null ? 'ribbon' : 'lock-closed'} size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.finaleTitle}>{finale.name}</Text>
            <Text style={styles.finaleSub}>{collected[finale.id] != null ? 'Collected' : `Stamp all ${stations.length} stations to earn it`}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((C) => ({
  card: { backgroundColor: PAPER, borderRadius: 26, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#E4DCC8' },
  cardTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4, paddingBottom: 10 },
  kicker: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.4, color: TEAL },
  cardTitle: { fontFamily: F.bold, fontSize: 26, color: INK, letterSpacing: -0.6, marginTop: 2 },
  cardSub: { fontFamily: F.reg, fontSize: 12, color: '#5B6F86', marginTop: 2 },
  cardArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 6, borderRadius: 3, backgroundColor: AQUA, marginTop: 12, marginHorizontal: 4, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: TEAL },

  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-start' },
  backText: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  poster: { alignSelf: 'center', backgroundColor: PAPER, borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#E4DCC8', overflow: 'hidden' },
  pTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingTop: 6 },
  pLine: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.4, color: '#fff', backgroundColor: TEAL, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  pTitle: { fontFamily: F.bold, fontSize: 54, color: INK, letterSpacing: -2, textAlign: 'center', marginTop: 10, lineHeight: 58 },
  pUnderline: { alignSelf: 'center', width: 150, height: 5, borderRadius: 3, backgroundColor: TEAL, marginTop: 2, transform: [{ rotate: '-2deg' }] },
  pTag: { fontFamily: F.semi, fontSize: 14, color: '#3B5473', textAlign: 'center', marginTop: 12 },
  pill: { alignSelf: 'center', backgroundColor: INK, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 7, marginTop: 12, marginBottom: 14 },
  pillText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2, color: '#fff' },
  pHead: { fontFamily: F.bold, fontSize: 16, color: INK, textAlign: 'center', marginTop: 20, marginBottom: 10, letterSpacing: -0.3 },
  book: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#D9D2BE', paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  spine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#D9D2BE' },
  page: { flex: 1, paddingHorizontal: 4, justifyContent: 'center' },
  pageRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  progress: { fontFamily: F.semi, fontSize: 12, color: TEAL, textAlign: 'center', marginTop: 12 },
  names: { fontFamily: F.reg, fontSize: 11, lineHeight: 17, color: '#4D637D', textAlign: 'center', marginTop: 10, paddingHorizontal: 8 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#E4DCC8' },
  stepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: AQUA, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stepTitle: { fontFamily: F.bold, fontSize: 12, color: INK },
  stepText: { fontFamily: F.reg, fontSize: 10.5, lineHeight: 14, color: '#5B6F86', marginTop: 3 },
  foot: { backgroundColor: INK, borderRadius: 16, paddingVertical: 11, marginTop: 14 },
  footText: { fontFamily: F.semi, fontSize: 12, color: '#fff', textAlign: 'center' },

  h2: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: -0.4, marginTop: 26, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { width: '47%' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cellName: { flex: 1, fontFamily: F.semi, fontSize: 13, color: C.ink, paddingRight: 6 },
  cellCount: { fontFamily: F.reg, fontSize: 13, color: C.muted },
  finale: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: INK, borderRadius: 22, padding: 16, marginTop: 22 },
  finaleTitle: { fontFamily: F.bold, fontSize: 15, color: '#fff' },
  finaleSub: { fontFamily: F.reg, fontSize: 12, color: '#BCD3E6', marginTop: 2 },
}));
