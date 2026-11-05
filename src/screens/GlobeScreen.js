import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { globeStyle } from '../mapStyle';
import { EMPTY, buildFeedGeoJSON } from '../globeFeed';
import { HUB, ago, useCaptureFeed } from '../demoFeed';
import { F, STAMP_THEMES, makeStyles, useColors } from '../theme';

// The real MapLibre map shown as a 3D globe in the cartoon style. Every capture on the network flies in as an arc
// to the event hub. The events are SIMULATED (see demoFeed.js) and labelled as such.

const HUB_COORD = [HUB.lng, HUB.lat];
const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

const HUB_POINT = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: HUB_COORD } }] };

export function GlobeScreen({ setScrollLock }) {
  const styles = useStyles();
  const C = useColors();
  const camera = useRef(null);
  const center = useRef([HUB.lng - 8, 16]);
  const pausedUntil = useRef(0);
  const events = useRef([]);
  const [geo, setGeo] = useState({ arcs: EMPTY, points: EMPTY });
  const [, setNow] = useState(0);

  const { items, total } = useCaptureFeed((ev) => {
    events.current.push({ from: [ev.spot.lng, ev.spot.lat], t0: Date.now() });
    if (events.current.length > 12) events.current.shift();
  });

  // animate the arcs and pulses (about 10 frames a second is plenty on a globe)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      events.current = events.current.filter((e) => now - e.t0 < 3400);
      setGeo((prev) => (events.current.length === 0 && prev.arcs.features.length === 0 && prev.points.features.length === 0 ? prev : buildFeedGeoJSON(events.current, now, HUB_COORD)));
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

  // keep "ago" labels counting
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const latest = items[0];

  return (
    <>
      <Text style={styles.title}>Globe</Text>
      <Text style={styles.sub}>Every stamp captured on the network, landing at the ETHGlobal Mumbai hub.</Text>

      <View
        style={styles.card}
        onTouchStart={() => { pausedUntil.current = Date.now() + 6000; setScrollLock(true); }}
        onTouchEnd={() => { pausedUntil.current = Date.now() + 4000; setScrollLock(false); }}
        onTouchCancel={() => setScrollLock(false)}
      >
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={globeStyle}
          androidView="texture"
          logo={false}
          compass={false}
          touchPitch={false}
          touchRotate={false}
          attributionPosition={{ bottom: 6, right: 6 }}
          onRegionDidChange={(e) => {
            if (e.nativeEvent.userInteraction) center.current = e.nativeEvent.center;
          }}
        >
          <Camera ref={camera} initialViewState={{ center: center.current, zoom: 1.35 }} minZoom={0.6} maxZoom={9} />

          <GeoJSONSource id="feed-arcs" data={geo.arcs}>
            <Layer id="feed-arc-halo" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': ['*', 0.85, ['get', 'o']] }} />
            <Layer id="feed-arc" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#F26B21', 'line-width': 3, 'line-opacity': ['get', 'o'] }} />
          </GeoJSONSource>

          <GeoJSONSource id="feed-points" data={geo.points}>
            <Layer
              id="feed-ring"
              type="circle"
              filter={['==', ['get', 'kind'], 'ring']}
              paint={{ 'circle-radius': ['get', 'r'], 'circle-color': '#FFFFFF', 'circle-opacity': 0, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-opacity': ['get', 'o'] }}
            />
            <Layer
              id="feed-dot"
              type="circle"
              filter={['==', ['get', 'kind'], 'dot']}
              paint={{ 'circle-radius': ['get', 'r'], 'circle-color': '#FFFFFF', 'circle-opacity': ['get', 'o'], 'circle-stroke-color': '#F26B21', 'circle-stroke-width': 2.5, 'circle-stroke-opacity': ['get', 'o'] }}
            />
          </GeoJSONSource>

          <GeoJSONSource id="hub" data={HUB_POINT}>
            <Layer id="hub-dot" type="circle" paint={{ 'circle-radius': 8, 'circle-color': '#F26B21', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 }} />
          </GeoJSONSource>
        </Map>

        <View style={styles.topRow} pointerEvents="none">
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · DEMO FEED</Text>
          </View>
          <View style={styles.count}>
            <Text style={styles.countNum}>{total}</Text>
            <Text style={styles.countLabel}>captured</Text>
          </View>
        </View>

        {latest && (
          <View style={styles.toast} pointerEvents="none">
            <Ionicons name="checkmark-circle" size={16} color={C.green} />
            <Text style={styles.toastText} numberOfLines={1}>
              <Text style={styles.toastWho}>{latest.who}</Text> captured {latest.spot.name}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.hint}>Drag to spin, pinch to zoom in on the map.</Text>

      <View style={styles.feedHead}>
        <Text style={styles.feedTitle}>Network activity</Text>
        <Text style={styles.feedMeta}>simulated</Text>
      </View>
      {items.slice(0, 5).map((ev) => {
        const t = STAMP_THEMES[ev.spot.theme];
        return (
          <View key={ev.id} style={styles.row}>
            <View style={[styles.bubble, { backgroundColor: t.frame }]}>
              <Ionicons name={ev.spot.icon} size={18} color={t.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                <Text style={styles.mono}>{ev.who}</Text> captured {ev.spot.name}
              </Text>
              <Text style={styles.rowMeta}>{ev.spot.city} · {ago(ev.at)}</Text>
            </View>
          </View>
        );
      })}
      {items.length === 0 && <Text style={styles.waiting}>Waiting for the first capture…</Text>}
    </>
  );
}

const useStyles = makeStyles((C) => ({
  title: { fontFamily: F.bold, fontSize: 30, color: C.ink, letterSpacing: -0.8 },
  sub: { fontFamily: F.reg, fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 6, marginBottom: 18 },
  card: { height: 440, borderRadius: 28, backgroundColor: '#000', overflow: 'hidden' }, // space

  topRow: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, height: 30, borderRadius: 15 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveText: { fontFamily: F.semi, fontSize: 10, letterSpacing: 0.8, color: '#fff' },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, height: 30, borderRadius: 15, alignItems: 'center' },
  countNum: { fontFamily: F.bold, fontSize: 16, color: '#fff' },
  countLabel: { fontFamily: F.reg, fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  toast: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, height: 40, borderRadius: 20 },
  toastText: { flex: 1, fontFamily: F.reg, fontSize: 12, color: '#fff' },
  toastWho: { fontFamily: F.semi, color: C.green },
  hint: { fontFamily: F.reg, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 },

  feedHead: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  feedTitle: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: -0.4 },
  feedMeta: { fontFamily: F.reg, fontSize: 11, color: C.muted },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 10, marginBottom: 8 },
  bubble: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, paddingLeft: 12 },
  rowTitle: { fontFamily: F.semi, fontSize: 13, color: C.ink },
  mono: { fontFamily: F.mono },
  rowMeta: { fontFamily: F.reg, fontSize: 11, color: C.muted, marginTop: 2 },
  waiting: { fontFamily: F.reg, fontSize: 12, color: C.muted, textAlign: 'center', padding: 16 },
}));
