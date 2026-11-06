import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { globeStyle } from '../mapStyle';
import { BLINK_SECONDS, EMPTY, buildFeedGeoJSON } from '../globeFeed';
import { useCaptureFeed } from '../demoFeed';
import { F, makeStyles, useColors } from '../theme';

// The real MapLibre map shown as a 3D globe in the cartoon style. Every capture on the network blinks at the
// coordinates where the stamp was minted. The events are SIMULATED (see demoFeed.js) and labelled as such.

const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

export function GlobeScreen() {
  const styles = useStyles();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const fitZoom = Math.log2((W * Math.PI) / 512) + 0.2; // the globe's width matches the screen's
  const camera = useRef(null);
  const center = useRef([72.8, 16]);
  const pausedUntil = useRef(0);
  const events = useRef([]);
  const [geo, setGeo] = useState({ points: EMPTY });

  const { items, total } = useCaptureFeed((ev) => {
    events.current.push({ from: [ev.spot.lng, ev.spot.lat], t0: Date.now() });
    if (events.current.length > 12) events.current.shift();
  });

  // animate the blinks (about 10 frames a second is plenty on a globe)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      events.current = events.current.filter((e) => now - e.t0 < BLINK_SECONDS * 1000);
      setGeo((prev) => (events.current.length === 0 && prev.points.features.length === 0 ? prev : buildFeedGeoJSON(events.current, now)));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // slow auto-spin; stops while the user is dragging and resumes a few seconds after they let go
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const [lng, lat] = center.current;
      const next = wrapLng(lng + 7);
      center.current = [next, lat];
      camera.current?.easeTo({ center: [next, lat], duration: 1000, easing: 'linear' });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const latest = items[0];

  return (
    <View style={[styles.full, { width: W, height: H }]}>
      <Map
        style={{ position: 'absolute', left: 0, top: insets.top + 215, width: W, height: H - insets.top - 215 - insets.bottom - 120 }}
        mapStyle={globeStyle}
        androidView="texture"
        logo={false}
        compass={false}
        touchPitch={false}
        touchRotate={false}
        attribution={false}
        onRegionDidChange={(e) => {
          if (e.nativeEvent.userInteraction) { center.current = e.nativeEvent.center; pausedUntil.current = Date.now() + 5000; }
        }}
      >
        <Camera ref={camera} initialViewState={{ center: center.current, zoom: fitZoom }} minZoom={fitZoom - 0.4} maxZoom={9} />

        <GeoJSONSource id="feed-points" data={geo.points}>
          <Layer
            id="feed-ring"
            type="circle"
            filter={['==', ['get', 'kind'], 'ring']}
            paint={{ 'circle-radius': ['get', 'r'], 'circle-color': '#F26B21', 'circle-opacity': ['*', 0.25, ['get', 'o']], 'circle-stroke-color': '#F26B21', 'circle-stroke-width': 1.2, 'circle-stroke-opacity': ['get', 'o'] }}
          />
          <Layer
            id="feed-dot"
            type="circle"
            filter={['==', ['get', 'kind'], 'dot']}
            paint={{ 'circle-radius': ['get', 'r'], 'circle-color': '#FFFFFF', 'circle-opacity': ['get', 'o'] }}
          />
        </GeoJSONSource>
      </Map>

      {/* words over the globe */}
      <View style={[styles.top, { top: insets.top + 76 }]} pointerEvents="none">
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE · DEMO FEED</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countNum}>{total}</Text>
          <Text style={styles.countLabel}>captured</Text>
        </View>
      </View>
      <View style={[styles.head, { top: insets.top + 124 }]} pointerEvents="none">
        <Text style={styles.title}>Globe</Text>
        <Text style={styles.sub}>Every stamp minted blinks here, right where it happened.</Text>
      </View>

      {latest && (
        <View style={[styles.toast, { bottom: insets.bottom + 108 }]} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={C.green} />
          <Text style={styles.toastText} numberOfLines={1}>
            <Text style={styles.toastWho}>{latest.who}</Text> captured {latest.spot.name}
          </Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  full: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' }, // space

  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, height: 30, borderRadius: 15 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveText: { fontFamily: F.semi, fontSize: 10, letterSpacing: 0.8, color: '#fff' },
  count: { flexDirection: 'row', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, height: 30, borderRadius: 15, alignItems: 'center' },
  countNum: { fontFamily: F.bold, fontSize: 16, color: '#fff' },
  countLabel: { fontFamily: F.reg, fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  head: { position: 'absolute', left: 20, right: 20 },
  title: { fontFamily: F.bold, fontSize: 32, color: '#fff', letterSpacing: -1 },
  sub: { fontFamily: F.reg, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.7)', marginTop: 4, maxWidth: 280 },

  toast: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, height: 40, borderRadius: 20 },
  toastText: { flex: 1, fontFamily: F.reg, fontSize: 12, color: '#fff' },
  toastWho: { fontFamily: F.semi, color: C.green },
}));
