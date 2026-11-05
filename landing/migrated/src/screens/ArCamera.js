import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Stamp3D } from '../Stamp3D';
import { BackButton } from '../ui';
import { APPROACH_M, CAPTURE_M } from '../spots';
import { ACCENT, F } from '../theme';

// The capture camera. A live camera preview with the stamp floating in front of you as a spinnable 3D collectible.
//
// REAL: the camera preview, the camera permission flow, and QR scanning for anchor spots (any QR code anchors the stamp).
// NOT REAL YET: the stamp is not anchored to the world (no ARCore), and the "location lock" chip is a preview label.
// The camera frames are never recorded or saved.
//
// Always dark, whatever the app theme, because it sits over a camera image.

const DARK = '#10151C';
const ArModel = () => null; // AR is native-only; the landing page shows the spinnable stamp instead
const ModelView = () => null;

export function ArCamera({ spot, user, onClose, onCapture, scene }) {
  const [perm, requestPerm] = useCameraPermissions();
  const [noCamera, setNoCamera] = useState(false); // "continue without camera": a design preview over a dark backdrop
  const isAnchor = spot.kind === 'anchor';
  const [anchored, setAnchored] = useState(!isAnchor);
  const [busy, setBusy] = useState(false);
  const [hud, setHud] = useState({ stage: 'starting' }); // reported by the AR view: stage, turn angle
  const [session, setSession] = useState(0); // bump to re-align
  const [modelState, setModelState] = useState('loading'); // only used when the spot has a 3D model
  const hasModel = false; // the landing page has no AR model; the spinnable stamp is shown
  const [arFailed, setArFailed] = useState(false); // ARCore unavailable or the model failed in AR -> use the WebView viewer
  const useAr = hasModel && !arFailed;
  const showModel = hasModel && (useAr || modelState !== 'error');

  const flash = useRef(new Animated.Value(0)).current;
  const collect = useRef(new Animated.Value(0)).current; // 0 -> 1: the stamp is drawn into the shutter
  const pulse = useRef(new Animated.Value(0)).current;
  const scanned = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const a = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => { alive.current = false; a.stop(); };
  }, [pulse]);

  const camOn = !!perm?.granted;
  const cap = spot.captureM ?? CAPTURE_M;
  const inZone = spot.dist == null || spot.dist <= cap; // no GPS fix yet: do not block (design preview)
  const ready = (camOn || noCamera) && anchored && inZone;

  const onScan = () => {
    if (scanned.current) return;
    scanned.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAnchored(true);
  };

  const capture = () => {
    if (!ready || busy) return;
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      Animated.timing(collect, { toValue: 1, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      if (alive.current) onCapture();
    });
  };

  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.55] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const collectY = collect.interpolate({ inputRange: [0, 1], outputRange: [0, 300] });
  const collectScale = collect.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] });
  const collectOpacity = collect.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] });

  const arLive = camOn && useAr && anchored; // the AR view is on screen (from afar too; capture stays locked until inZone)
  const placed = hud.stage === 'placed' || hud.stage === 'loaded';
  const offscreen = arLive && placed && hud.turn != null && Math.abs(hud.turn) > 28;
  const toast = !camOn && !noCamera ? null : arLive ? TOAST[hud.stage] ?? null : null;
  const acc = user?.accuracy;
  const gpsBad = acc != null && acc > 30;
  // how far along the walk: 0 at the edge of the approach radius, 1 at the capture radius
  const appr = spot.approachM ?? APPROACH_M;
  const progress = spot.dist == null ? 0 : Math.max(0, Math.min(1, (appr - spot.dist) / Math.max(1, appr - cap)));
  const distText = spot.dist == null ? '—' : spot.dist >= 1000 ? `${(spot.dist / 1000).toFixed(1)} km` : `${Math.round(spot.dist)} m`;
  const sub = isAnchor && !anchored ? 'Scan the venue QR code' : inZone ? 'You are here. Tap to capture' : `${Math.max(1, Math.round(spot.dist - cap))} m to the capture zone`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {arLive ? (
        <ArModel key={session} model={spot.model} target={spot.coord} user={user} onFail={() => setArFailed(true)} onHud={setHud} />
      ) : camOn ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter={false}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={isAnchor && !anchored ? onScan : undefined}
        />
      ) : (
        <View style={styles.mock}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.gridH, { top: `${54 + i * i * 1.8 + i * 3}%` }]} />
          ))}
        </View>
      )}
      {showModel && !useAr && anchored && <ModelView model={spot.model} onState={setModelState} />}
      {/* soft shading so the controls stay readable over any camera image */}

      <SafeAreaView style={styles.fill} pointerEvents="box-none">
        <View style={styles.top}>
          <BackButton icon="close" onPress={onClose} light />
          {arLive && (
            <View style={styles.topRight}>
              <View style={styles.gps}>
                <View style={[styles.dot, { backgroundColor: acc == null ? '#B9BCC6' : gpsBad ? '#F5A524' : ACCENT.green }]} />
                <Text style={styles.gpsText}>{acc == null ? 'GPS…' : `GPS ±${Math.round(acc)} m`}</Text>
              </View>
              <Pressable onPress={() => { setHud({ stage: 'starting' }); setSession((n) => n + 1); }} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="locate" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.center} pointerEvents="box-none">
          {!camOn && !noCamera ? (
            <PermissionCard perm={perm} onAllow={requestPerm} onSkip={() => setNoCamera(true)} />
          ) : isAnchor && !anchored ? (
            <ScanFrame onDemo={onScan} />
          ) : !useAr || !hasModel ? (
            <>
              <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ring }] }]} pointerEvents="none" />
              {scene}
              {!scene && !showModel && (
                <Animated.View style={{ opacity: collectOpacity, transform: [{ translateY: collectY }, { scale: collectScale }] }}>
                  <Stamp3D spot={spot} width={210} onPress={capture} />
                </Animated.View>
              )}
              {!scene && <View style={styles.hint}>
                <Ionicons name="sync" size={15} color="#0B0B0F" />
                <Text style={styles.hintText}>{showModel ? 'Turn around to find it · drag to spin' : 'Drag to spin · tap or press capture'}</Text>
              </View>}
            </>
          ) : null}

          {!!toast && (
            <View style={styles.toast} pointerEvents="none">
              {toast.busy && <ActivityIndicator size={18} color="#fff" style={{ width: 18, height: 18 }} />}
              <Text style={styles.toastText}>{toast.text}</Text>
            </View>
          )}
          {gpsBad && arLive && !toast && (
            <View style={[styles.toast, { backgroundColor: 'rgba(180,83,0,0.75)' }]} pointerEvents="none">
              <Text style={styles.toastText}>GPS is rough. Step outside for a better fix.</Text>
            </View>
          )}
          {offscreen && (
            <View style={[styles.edge, hud.turn > 0 ? { right: 14 } : { left: 14 }]} pointerEvents="none">
              <Ionicons name={hud.turn > 0 ? 'chevron-forward' : 'chevron-back'} size={30} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.bottom}>
          <View style={styles.bar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{spot.name}</Text>
              <Text style={styles.dist}>{isAnchor && !anchored ? 'Scan first' : distText}</Text>
              <View style={styles.track}>
                <View style={[styles.fillBar, { width: `${(inZone ? 1 : progress) * 100}%`, backgroundColor: inZone ? ACCENT.green : '#FFFFFFCC' }]} />
              </View>
              <Text style={[styles.sub, inZone && { color: ACCENT.green }]} numberOfLines={1}>{sub}</Text>
            </View>
            <Pressable onPress={capture} disabled={!ready || busy} style={[styles.shutterOuter, !ready && { borderColor: 'rgba(255,255,255,0.4)' }]} hitSlop={10}>
              <View style={[styles.shutterInner, { backgroundColor: ready ? ACCENT.green : 'rgba(255,255,255,0.14)' }]}>
                <Ionicons name={ready ? 'scan' : 'lock-closed'} size={ready ? 26 : 22} color={ready ? '#0B0B0F' : '#FFFFFFB3'} />
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <Animated.View style={[styles.flash, { opacity: flash }]} pointerEvents="none" />
    </View>
  );
}

const TOAST = {
  starting: { text: 'Starting AR…', busy: true },
  upright: { text: 'Hold the phone upright, facing the horizon' },
  calibrating: { text: 'Calibrating compass… hold still', busy: true },
  placed: { text: 'Loading model…', busy: true },
};

// A fade from dark to clear built from stacked translucent layers (no gradient library needed).
function Scrim({ edge, steps }) {
  return (
    <View style={[styles.scrim, edge === 'top' ? { top: 0 } : { bottom: 0 }]} pointerEvents="none">
      {steps.map((h) => (
        <View key={h} style={[styles.scrimLayer, edge === 'top' ? { top: 0 } : { bottom: 0 }, { height: h }]} />
      ))}
    </View>
  );
}

function PermissionCard({ perm, onAllow, onSkip }) {
  const denied = perm && !perm.granted && !perm.canAskAgain;
  return (
    <View style={styles.permCard}>
      <View style={styles.permIcon}>
        <Ionicons name="camera" size={26} color="#0B0B0F" />
      </View>
      <Text style={styles.permTitle}>Let the stamp appear in front of you</Text>
      <Text style={styles.permBody}>
        World3 uses the camera so the stamp floats in your view, and to scan the QR code at venues. Nothing is recorded or saved.
      </Text>
      {denied ? (
        <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.permBtnText}>Open settings</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.permBtn} onPress={onAllow}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      )}
      <Pressable onPress={onSkip} hitSlop={8}>
        <Text style={styles.permSkip}>Continue without camera</Text>
      </Pressable>
    </View>
  );
}

function ScanFrame({ onDemo }) {
  const corner = (pos) => <View style={[styles.qrCorner, pos]} />;
  return (
    <View style={styles.scanWrap}>
      <View style={styles.qrBox}>
        {corner({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 })}
        {corner({ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 })}
        {corner({ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 })}
        {corner({ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 })}
      </View>
      <View style={styles.hint}>
        <Ionicons name="qr-code" size={15} color="#0B0B0F" />
        <Text style={styles.hintText}>Point at the QR code at the venue</Text>
      </View>
      <Pressable onPress={onDemo} hitSlop={8}>
        <Text style={styles.permSkip}>Use a demo code (preview)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK },
  fill: { flex: 1 },
  mock: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: DARK },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  scrim: { position: 'absolute', left: 0, right: 0, height: 0 },
  scrimLayer: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.04)' },

  top: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, height: 34, borderRadius: 17 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT.green },
  gpsText: { fontFamily: F.bold, fontSize: 11, color: '#fff' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 3, borderColor: ACCENT.green, top: '14%' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 15, height: 38, borderRadius: 19, marginTop: 14 },
  hintText: { fontFamily: F.bold, fontSize: 12, color: '#0B0B0F' },
  toast: { position: 'absolute', top: '22%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, height: 40, borderRadius: 20, maxWidth: '88%' },
  toastText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  edge: { position: 'absolute', top: '45%', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

  bottom: { paddingHorizontal: 18, paddingBottom: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(12,16,22,0.62)', borderRadius: 30, paddingLeft: 22, paddingRight: 14, paddingVertical: 14 },
  name: { fontFamily: F.bold, fontSize: 12, color: '#FFFFFFB3', letterSpacing: 0.3 },
  dist: { fontFamily: F.black, fontSize: 30, color: '#fff', letterSpacing: -0.8, marginTop: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 6, overflow: 'hidden' },
  fillBar: { height: 4, borderRadius: 2 },
  sub: { fontFamily: F.med, fontSize: 12, color: '#FFFFFFB3', marginTop: 7 },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },

  flash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#fff' },

  permCard: { width: '86%', backgroundColor: 'rgba(16,21,28,0.92)', borderRadius: 26, padding: 22, alignItems: 'center' },
  permIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT.green, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontFamily: F.black, fontSize: 20, color: '#fff', textAlign: 'center', marginTop: 14 },
  permBody: { fontFamily: F.med, fontSize: 13, lineHeight: 19, color: '#B9BCC6', textAlign: 'center', marginTop: 8 },
  permBtn: { alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  permBtnText: { fontFamily: F.bold, fontSize: 15, color: '#0B0B0F' },
  permSkip: { fontFamily: F.bold, fontSize: 12, color: '#B9BCC6', marginTop: 14 },

  scanWrap: { alignItems: 'center' },
  qrBox: { width: 240, height: 240 },
  qrCorner: { position: 'absolute', width: 44, height: 44, borderColor: '#fff' },
});
