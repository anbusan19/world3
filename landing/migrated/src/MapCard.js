import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCartoonStyle } from './mapStyle';
import { formatDistance } from './geo';
import { makeStyles, useColors, useTheme } from './theme';

export const MUMBAI = [72.8347, 18.9322]; // between the Gateway of India and CSMT
const START_ZOOM = 12.6;

const GREEN = '#A6D16C';
const FONT = { med: 'PlusJakartaSans_500Medium', bold: 'PlusJakartaSans_700Bold' };

const GPS_TEXT = {
  asking: 'Finding you…',
  denied: 'Location off · showing Mumbai',
  error: 'GPS unavailable · showing Mumbai',
};

// spots: [{ id, name, coord: [lng, lat], tint, icon, dist }]
// user: { status, coords }
export function MapCard({ spots, user, selectedId, onSelect, setScrollLock }) {
  const styles = useStyles();
  const C = useColors();
  const { isDark } = useTheme();
  const camera = useRef(null);
  const selected = spots.find((s) => s.id === selectedId) ?? spots[0];

  const goToMe = () => user.coords && camera.current?.flyTo({ center: user.coords, zoom: 15, duration: 900 });
  const goToMumbai = () => camera.current?.flyTo({ center: MUMBAI, zoom: START_ZOOM, duration: 900 });

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
      >
        <Camera ref={camera} initialViewState={{ center: MUMBAI, zoom: START_ZOOM }} minZoom={9} maxZoom={17} />

        {spots.map((s) => (
          <ViewAnnotation key={s.id} id={`spot-${s.id}`} lngLat={s.coord} anchor="center" onPress={() => onSelect(s.id)}>
            <View style={[styles.pin, { backgroundColor: s.tint }, s.id === selected.id && styles.pinSelected]}>
              <Ionicons name={s.icon} size={20} color="#F26B21" />
            </View>
          </ViewAnnotation>
        ))}

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
          <View style={[styles.dot, user.status === 'granted' && { backgroundColor: GREEN }]} />
          <Text style={styles.tagText}>{user.status === 'granted' ? 'GPS on' : GPS_TEXT[user.status]}</Text>
        </View>
        <View style={styles.buttons}>
          <Pressable style={[styles.btn, !user.coords && { opacity: 0.45 }]} onPress={goToMe} disabled={!user.coords}>
            <Ionicons name="navigate" size={14} color={C.ink} />
            <Text style={styles.btnText}>Me</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={goToMumbai}>
            <Ionicons name="map" size={14} color={C.ink} />
            <Text style={styles.btnText}>Mumbai</Text>
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

  pin: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  pinSelected: { width: 50, height: 50, borderRadius: 25, borderColor: C.ink },
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
