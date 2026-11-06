import { useEffect, useRef, useState } from 'react';
import { usePhoneSize as useWindowDimensions } from './phoneSize';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCartoonStyle } from './mapStyle';
import { formatDistance } from './geo';
import { STAMP_THEMES, makeStyles, useColors, useTheme } from './theme';

export const MUMBAI = [72.8347, 18.9322]; // between the Gateway of India and CSMT
// The map opens on YOU, zoomed out so that half the screen's width is 50 km. With no location yet it shows Mumbai
// and flies to you the moment the first position arrives.
const NEAR_ZOOM = 15;
const RADIUS_M = 50_000;
const M_PER_PX_Z0 = 78271.5; // metres per screen pixel at zoom 0 on the equator (512 px tiles)
// the zoom at which half the screen is `km` wide at this latitude, and the other way round
const zoomForKm = (km, lat, w) => Math.log2((M_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180) * (w / 2)) / (km * 1000));
const kmAtZoom = (zoom, lat, w) => (M_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180) * (w / 2)) / 2 ** zoom / 1000;
const fmtAlt = (km) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`);

const GREEN = '#A6D16C';
const FONT = { med: 'PlusJakartaSans_500Medium', bold: 'PlusJakartaSans_700Bold' };

const GPS_TEXT = {
  asking: 'Finding you…',
  searching: 'Searching for GPS…',
  denied: 'Location off · showing Mumbai',
  error: 'GPS unavailable · showing Mumbai',
};

// what the pill says once we have a position: how it was found and how sure we are (in metres)
function gpsLabel(user) {
  const m = user.accuracy != null ? ` ±${Math.round(user.accuracy)} m` : '';
  if (user.source === 'gps') return `GPS${m}`;
  if (user.source === 'network') return `Wi-Fi/cell${m}`;
  return 'Last known place';
}

// spots: [{ id, name, coord: [lng, lat], tint, icon, dist }]
// user: { status, coords }
export function MapCard({ spots, user, selectedId, onSelect, setScrollLock, fill = false, topOffset = 12 }) {
  const styles = useStyles();
  const C = useColors();
  const { isDark } = useTheme();
  const win = useWindowDimensions();
  const lat0 = (user.coords ?? MUMBAI)[1];
  const WIDE_ZOOM = zoomForKm(50, lat0, win.width);
  const camera = useRef(null);
  const nearby = user.coords ? spots.filter((s) => s.dist == null || s.dist <= RADIUS_M) : spots;
  const shown = nearby.length ? nearby : spots;
  const selected = spots.find((s) => s.id === selectedId) ?? spots[0];

  // zoomed far out, spots that sit close together are drawn as ONE pin with a count; zoom in and they separate
  const [zoom, setZoom] = useState(() => zoomForKm(50, (user.coords ?? MUMBAI)[1], win.width));
  const cell = zoom >= 11.5 ? 0 : 0.45 / 2 ** (zoom - 8); // grid size in degrees (about 100 km / 2^(zoom-7) across)
  const groups = [];
  for (const sp of shown) {
    const g = cell > 0 && groups.find((x) => Math.abs(x.lng - sp.coord[0]) < cell / 4 && Math.abs(x.lat - sp.coord[1]) < cell / 4);
    if (g) g.items.push(sp);
    else groups.push({ lng: sp.coord[0], lat: sp.coord[1], items: [sp] });
  }

  const firstSel = useRef(true);
  useEffect(() => {
    if (firstSel.current) { firstSel.current = false; return; }
    const sp = spots.find((x) => x.id === selectedId);
    if (sp && fill) camera.current?.flyTo({ center: sp.coord, zoom: Math.max(zoom, 12), duration: 900 });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const centred = useRef(false);
  useEffect(() => {
    if (user.coords && !centred.current) {
      centred.current = true;
      camera.current?.flyTo({ center: user.coords, zoom: WIDE_ZOOM, duration: 1200 });
    }
  }, [user.coords]);

  const goToMe = () => user.coords && camera.current?.flyTo({ center: user.coords, zoom: NEAR_ZOOM, duration: 900 });
  const goWide = () => camera.current?.flyTo({ center: user.coords ?? MUMBAI, zoom: WIDE_ZOOM, duration: 900 });

  return (
    <View
      style={fill ? [styles.cardFill, { width: win.width, height: win.height }] : styles.card}
      // The map pans on touch; stop the page scrolling while a finger is on it.
      onTouchStart={() => setScrollLock?.(true)}
      onTouchEnd={() => setScrollLock?.(false)}
      onTouchCancel={() => setScrollLock?.(false)}
    >
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={getCartoonStyle(isDark)}
        androidView="texture"
        logo={false}
        compass={false}
        touchPitch={false}
        touchRotate={false}
        attributionPosition={{ bottom: 6, right: 6 }}
        onRegionIsChanging={(e) => {
          const z = e.nativeEvent?.zoom;
          if (typeof z === 'number') setZoom((old) => (Math.abs(old - z) > 0.04 ? z : old)); // the altitude reading follows the pinch
        }}
        onRegionDidChange={(e) => {
          const z = e.nativeEvent?.zoom;
          if (typeof z === 'number') setZoom(z);
        }}
      >
        <Camera ref={camera} initialViewState={{ center: user.coords ?? MUMBAI, zoom: WIDE_ZOOM }} minZoom={5} maxZoom={17} />

        {groups.map((g) => {
          const s = g.items.find((x) => x.id === selected.id) ?? g.items[0];
          const on = g.items.some((x) => x.id === selected.id);
          const many = g.items.length > 1;
          const t = STAMP_THEMES[s.theme] ?? STAMP_THEMES.coral;
          return (
            <ViewAnnotation
              key={g.items.map((x) => x.id).join('+')}
              id={`spot-${g.items.map((x) => x.id).join('-')}`}
              lngLat={[g.lng, g.lat]}
              anchor="bottom"
              onPress={() => {
                onSelect(s.id);
                if (many) camera.current?.flyTo({ center: [g.lng, g.lat], zoom: Math.min(13, zoom + 3.5), duration: 800 });
              }}
            >
              <View style={styles.pinWrap}>
                {on && !many && (
                  <View style={styles.pinLabel}>
                    <Text style={styles.pinLabelText} numberOfLines={1}>{s.name}</Text>
                  </View>
                )}
                {many ? (
                  <View style={styles.cluster}>
                    <Text style={styles.clusterText}>{g.items.length}</Text>
                  </View>
                ) : (
                  <View style={[styles.medal, { backgroundColor: t.frame }, on && styles.medalOn]}>
                    <Ionicons name={s.icon} size={on ? 22 : 18} color={t.accent} />
                  </View>
                )}
                <View style={[styles.pinTip, { borderTopColor: many ? GREEN : '#FFFFFF' }]} />
              </View>
            </ViewAnnotation>
          );
        })}

        {user.coords && (
          <ViewAnnotation id="me" lngLat={user.coords} anchor="center">
            <View style={styles.meRing}>
              <View style={styles.meCore} />
            </View>
          </ViewAnnotation>
        )}
      </Map>

      <View style={[styles.topRow, fill && { top: topOffset }]} pointerEvents="box-none">
        <View style={styles.tag}>
          <View style={[styles.dot, user.status === 'granted' && { backgroundColor: user.source === 'gps' && user.accuracy <= 25 ? GREEN : '#F6C453' }]} />
          <Text style={styles.tagText}>{user.status === 'granted' ? gpsLabel(user) : GPS_TEXT[user.status]}</Text>
        </View>
        <View style={styles.buttons}>
          <Pressable style={[styles.btn, !user.coords && { opacity: 0.45 }]} onPress={goToMe} disabled={!user.coords}>
            <Ionicons name="navigate" size={14} color={C.ink} />
            <Text style={styles.btnText}>Me</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={goWide}>
            <Ionicons name="scan" size={14} color={C.ink} />
            <Text style={styles.btnText}>50 km</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.alt, fill ? { top: topOffset + 40 } : { bottom: 12, right: 12 }]} pointerEvents="none">
        <Ionicons name="airplane-outline" size={12} color={C.ink} />
        <Text style={styles.altText}>Altitude {fmtAlt(kmAtZoom(zoom, lat0, win.width))}</Text>
      </View>

      {!fill && <View style={styles.info} pointerEvents="none">
        <Text style={styles.infoName} numberOfLines={1}>{selected.name}</Text>
        <Text style={styles.infoMeta}>
          {selected.dist != null ? `${formatDistance(selected.dist)} away` : 'Distance needs GPS'}
        </Text>
      </View>}
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  cardFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0265AD' },
  card: { height: 320, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0265AD' },

  pinWrap: { alignItems: 'center' },
  medal: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  medalOn: { width: 48, height: 48, borderRadius: 24, borderColor: '#0B0B0F' },
  cluster: { minWidth: 44, height: 44, borderRadius: 22, paddingHorizontal: 6, backgroundColor: C.panel, borderWidth: 3, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  clusterText: { fontFamily: FONT.bold, fontSize: 16, color: '#fff' },
  pinTip: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  pinLabel: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 10, height: 26, justifyContent: 'center', marginBottom: 5, maxWidth: 170, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },
  pinLabelText: { fontFamily: FONT.bold, fontSize: 11, color: '#0B0B0F' },
  alt: { position: 'absolute', left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, paddingHorizontal: 11, height: 26, borderRadius: 13 },
  altText: { fontFamily: FONT.bold, fontSize: 11, color: C.ink },
  meRing: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0265AD55', alignItems: 'center', justifyContent: 'center' },
  meCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', borderWidth: 4, borderColor: '#0265AD' },

  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.card, paddingHorizontal: 11, height: 30, borderRadius: 15 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B9BCC6' },
  tagText: { fontFamily: FONT.bold, fontSize: 11, color: C.ink },
  buttons: { flexDirection: 'row', gap: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.card, paddingHorizontal: 11, height: 30, borderRadius: 15 },
  btnText: { fontFamily: FONT.bold, fontSize: 11, color: C.ink },

  info: { position: 'absolute', left: 12, bottom: 12, maxWidth: '70%', backgroundColor: C.panel, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  infoName: { fontFamily: FONT.bold, fontSize: 13, color: '#fff' },
  infoMeta: { fontFamily: FONT.med, fontSize: 11, color: GREEN, marginTop: 2 },
}));
