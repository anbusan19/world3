import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { Viro3DObject, ViroAmbientLight, ViroARScene, ViroARSceneNavigator, ViroDirectionalLight, ViroNode } from '@reactvision/react-viro';

// REAL AR (ARCore through ViroReact) with the model pinned to the spot's GPS position:
//  1. When the camera opens it takes a few seconds to line the AR world up with north (phone compass) and with your
//     GPS fix. Hold the phone upright and still.
//  2. The model is then placed at the spot's real coordinate, `dist` metres away in the right compass direction, at
//     ground level. A big model is visible from far off and grows as you walk toward it, because ARCore tracks your
//     movement. An arrow tells you which way to turn until it is in view.
// Accuracy limits: phone GPS is typically 5-20 m outdoors (worse indoors) and the compass can be off by 10-20 degrees,
// so the model may sit a few metres from the true spot. "Re-align" repeats step 1.
const D2R = Math.PI / 180;
const EYE = 1.4; // camera height above the ground, metres
const SAMPLES = 25; // compass samples averaged while calibrating

// Models exported in odd units can be tiny (a 9 cm taco). With the default scale 1 a small file is shown big enough to
// see from a distance (6 m). Any other scale set in the dashboard is used exactly.
function startScale(model) {
  const s = model.scale ?? 1;
  const max = Math.max(...(model.sizeM ?? [1]));
  if (s === 1 && max > 0 && max < 3) return 6 / max;
  return s;
}

const metresBetween = (a, b) => {
  const lat = ((a[1] + b[1]) / 2) * D2R;
  return [(b[0] - a[0]) * 111320 * Math.cos(lat), (b[1] - a[1]) * 110540]; // [east, north]
};

function Scene({ model, target, motion, userRef, onStage, onInfo }) {
  const [place, setPlace] = useState(null); // { pos:[x,y,z], yaw }
  const [scale, setScale] = useState(() => startScale(model));
  const [yaw, setYaw] = useState(0);
  const base = useRef({ scale: startScale(model), yaw: 0 });
  const cal = useRef({ n: 0, sx: 0, sy: 0, t0: Date.now() });
  const placedRef = useRef(null);
  const frames = useRef(0);

  const onCamera = (c) => {
    const t = c.cameraTransform ?? c;
    const pos = t.position;
    const fwd = t.forward;
    if (!pos || !fwd) return;
    frames.current++;
    const camAR = Math.atan2(fwd[0], -fwd[2]); // clockwise angle from AR -Z

    if (!placedRef.current) {
      const h = motion.current.heading; // compass heading of the camera, radians
      if (h == null || !userRef.current.coords) { onStage('starting'); return; }
      // ignore frames while the phone points steeply up/down (the heading is unstable there)
      if (Math.abs(fwd[1]) > 0.8) { onStage('upright'); return; }
      onStage('calibrating');
      const d = h - camAR; // how far the AR world is turned away from north
      cal.current.sx += Math.cos(d); cal.current.sy += Math.sin(d); cal.current.n++;
      const waited = Date.now() - cal.current.t0;
      if (cal.current.n >= SAMPLES && waited > 1500) {
        const off = Math.atan2(cal.current.sy, cal.current.sx);
        const [east, north] = metresBetween(userRef.current.coords, target);
        const dist = Math.hypot(east, north);
        const bearing = Math.atan2(east, north); // compass bearing from you to the spot
        const a = bearing - off; // the same direction in AR-world angles
        const mx = pos[0] + dist * Math.sin(a);
        const mz = pos[2] - dist * Math.cos(a);
        const my = pos[1] - EYE;
        // face the model toward you
        const face = Math.atan2(pos[0] - mx, pos[2] - mz) / D2R;
        const p = { pos: [mx, my, mz], face };
        placedRef.current = p;
        base.current.yaw = 0;
        setPlace(p);
        onStage('placed');
      }
      return;
    }
    // placed: report how far it is and which way to turn (every few frames)
    if (frames.current % 6) return;
    const [mx, my, mz] = placedRef.current.pos;
    const dx = mx - pos[0], dz = mz - pos[2];
    const dir = Math.atan2(dx, -dz); // angle of the model, same convention as camAR
    let turn = (dir - camAR) / D2R;
    turn = ((turn + 540) % 360) - 180; // -180..180, positive = turn right
    onInfo({ d: Math.hypot(dx, my - pos[1], dz), turn });
  };

  return (
    <ViroARScene anchorDetectionTypes={['PlanesHorizontal']} onCameraTransformUpdate={onCamera}>
      <ViroAmbientLight color="#FFFFFF" intensity={700} />
      <ViroDirectionalLight color="#FFFFFF" direction={[0.3, -1, -0.5]} intensity={900} />
      {place && (
        <ViroNode position={place.pos}>
          <Viro3DObject
            source={{ uri: model.url }}
            type="GLB"
            scale={[scale, scale, scale]}
            rotation={[0, place.face + (model.heading ?? 0) + yaw, 0]}
            onLoadEnd={() => onStage('loaded')}
            onError={(e) => onStage('error', e?.nativeEvent?.error ?? 'load failed')}
            onPinch={(state, factor) => {
              if (state === 1) base.current.scale = scale;
              setScale(Math.min(60, Math.max(0.05, base.current.scale * factor)));
            }}
            onRotate={(state, factor) => {
              if (state === 1) base.current.yaw = yaw;
              setYaw(base.current.yaw - factor);
            }}
          />
        </ViroNode>
      )}
    </ViroARScene>
  );
}

// `target` is [lng, lat]; `user` is { coords:[lng,lat], accuracy } and is read live through a ref.
export function ArModel({ model, target, user, onFail, onHud }) {
  const [stage, setStage] = useState('starting');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState(null);
  const userRef = useRef(user);
  userRef.current = user;
  const motion = useRef({ heading: null });

  // compass heading of the back camera, from the phone's absolute orientation (W3C alpha/beta/gamma)
  useEffect(() => {
    DeviceMotion.setUpdateInterval(50);
    const sub = DeviceMotion.addListener((d) => {
      const r = d?.rotation;
      if (!r) return;
      const cA = Math.cos(r.alpha), sA = Math.sin(r.alpha), cB = Math.cos(r.beta), sB = Math.sin(r.beta), cG = Math.cos(r.gamma), sG = Math.sin(r.gamma);
      const m13 = cA * sG + sA * sB * cG;
      const m23 = sA * sG - cA * sB * cG;
      motion.current.heading = Math.atan2(-m13, -m23); // camera looks along -Z of the device
    });
    return () => sub.remove();
  }, []);

  const onStage = useCallback((s, why) => {
    if (s === 'error') { setErr(why ?? ''); onFail?.(why); return; }
    setStage((cur) => (cur === 'loaded' || cur === 'placed') && s !== 'loaded' ? cur : s);
  }, [onFail]);
  const onInfo = useCallback((i) => setInfo((p) => (p && Math.abs(p.d - i.d) < 0.3 && Math.abs(p.turn - i.turn) < 4 ? p : i)), []);

  // everything visual (messages, distance, arrows) is drawn by the camera screen from this report
  useEffect(() => { onHud?.({ stage, turn: info?.turn ?? null, d: info?.d ?? null }); }, [stage, info, onHud]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <ViroARSceneNavigator
        autofocus
        style={StyleSheet.absoluteFill}
        initialScene={{ scene: () => <Scene model={model} target={target} motion={motion} userRef={userRef} onStage={onStage} onInfo={onInfo} /> }}
      />
      {!!err && <View style={styles.err} pointerEvents="none"><Text style={styles.errText} numberOfLines={2}>AR model failed: {err}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  err: { position: 'absolute', alignSelf: 'center', top: '30%', backgroundColor: '#000000B3', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, maxWidth: '86%' },
  errText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
