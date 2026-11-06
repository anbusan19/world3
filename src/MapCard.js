import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCartoonStyle } from './mapStyle';
import { Stamp } from './Stamp';
import { formatDistance } from './geo';
import { shortName } from './spots';
import { makeStyles, useColors, useTheme } from './theme';

export const MUMBAI = [72.8347, 18.9322]; // between the Gateway of India and CSMT
// The map opens on YOU, zoomed out far enough to show everything within about 100 km. With no location yet it
// shows Mumbai and flies to you the moment the first position arrives.
const WIDE_ZOOM = 7;
const NEAR_ZOOM = 15;
const RADIUS_M = 100_000;

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
export function MapCard({ spots, user, selectedId, onSelect, setScrollLock }) {
  const styles = useStyles();
  const C = useColors();
  const { isDark } = useTheme();
  const camera = useRef(null);
  const nearby = user.coords ? spots.filter((s) => s.dist == null || s.dist <= RADIUS_M) : spots;
  const shown = nearby.length ? nearby : spots;
  const selected = spots.find((s) => s.id === selectedId) ?? spots[0];

  // zoomed far out, spots that sit close together are drawn as ONE pin with a count; zoom in and they separate
  const [zoom, setZoom] = useState(WIDE_ZOOM);
  const cell = zoom >= 11.5 ? 0 : 0.9 / 2 ** (zoom - 7); // grid size in degrees (about 100 km / 2^(zoom-7) across)
  const groups = [];
  for (const sp of shown) {
    const g = cell > 0 && groups.find((x) => Math.abs(x.lng - sp.coord[0]) < cell / 4 && Math.abs(x.lat - sp.coord[1]) < cell / 4);
    if (g) g.items.push(sp);
    else groups.push({ lng: sp.coord[0], lat: sp.coord[1], items: [sp] });
  }

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
      style={styles.card}
      // The map pans on touch; stop the page scrolling while a finger is on it.
      onTouchStart={() => setScrollLock(true)}
      onTouchEnd={() => setScrollLock(false)}
      onTouchCancel={() => setScrollLock(false)}
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
        onRegionDidChange={(e) => {
          const z = e.nativeEvent?.zoom;
          if (typeof z === 'number') setZoom((old) => (Math.abs(old - z) > 0.25 ? z : old));
        }}
      >
        <Camera ref={camera} initialViewState={{ center: user.coords ?? MUMBAI, zoom: WIDE_ZOOM }} minZoom={5} maxZoom={17} />

        {groups.map((g) => {
          const s = g.items.find((x) => x.id === selected.id) ?? g.items[0];
          const on = g.items.some((x) => x.id === selected.id);
          const w = on ? 54 : 44;
          const many = g.items.length > 1;
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
                <View style={[styles.pin, on && styles.pinSelected]}>
                  <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} iconSize={16} labelSize={5.5} style={{ width: w }} />
                  {many && (
                    <View style={styles.count}>
                      <Text style={styles.countText}>{g.items.length}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.pinTip, on && styles.pinTipSelected]} />
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

      <View style={styles.topRow} pointerEvents="box-none">
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
            <Text style={styles.btnText}>100 km</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.info} pointerEvents="none">
        <Text style={styles.infoName} numberOfLines={1}>{selected.name}</Text>
        <Text style={styles.infoMeta}>
          {selected.dist != null ? `${formatDistance(selected.dist)} away` : 'Distance needs GPS'}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  card: { height: 320, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0265AD' },

  pinWrap: { alignItems: 'center' },
  pin: { padding: 3, borderRadius: 5, backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  pinSelected: { backgroundColor: '#F26B21' },
  count: { position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countText: { fontFamily: FONT.bold, fontSize: 11, color: '#fff' },
  pinTip: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.card },
  pinTipSelected: { borderTopColor: '#F26B21' },
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
