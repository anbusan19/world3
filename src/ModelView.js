import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { DeviceMotion } from 'expo-sensors';
import { getFeedBase } from './spots';

// Renders a spot's .glb over the camera with three.js inside a transparent WebView.
// REAL: the model loads from the dashboard server and is drawn with lighting; the phone's motion sensors turn the
// virtual camera, so the model stays put in the direction you first looked while you turn the phone, and you can
// drag to spin it. NOT REAL: no ARCore, so it does not track your position (walking closer does not make it bigger)
// and it is not locked to the ground. Needs internet for the three.js scripts (CDN).
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0';

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden;touch-action:none}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"${THREE}/build/three.module.js","three/addons/":"${THREE}/examples/jsm/"}}</script>
</head><body><script type="module">
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = T.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 500);
scene.add(new T.HemisphereLight(0xffffff, 0x6b7a8f, 1.6));
const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); scene.add(sun);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const EYE = 1.4; // metres above the ground
camera.position.set(0, EYE, 0);
const anchor = new T.Group(); scene.add(anchor); // moves the model out in front of where you first looked
let model = null, spin = 0, placed = false, cfg = null;
const qTarget = new T.Quaternion(), qDevice = new T.Quaternion(), e = new T.Euler();
const q1 = new T.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
let haveOrientation = false;

window.setOrientation = (a, b, g) => {
  e.set(b, a, -g, 'YXZ');
  qDevice.setFromEuler(e).multiply(q1);
  haveOrientation = true;
  if (!placed && model) place();
};
function place() {
  // put the model in front of the camera, level with the horizon, so it appears where you are looking right now
  const f = new T.Vector3(0, 0, -1).applyQuaternion(qDevice); f.y = 0;
  if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
  f.normalize();
  anchor.position.set(f.x * cfg.dist, 0, f.z * cfg.dist);
  anchor.rotation.y = Math.atan2(-f.x, -f.z) + Math.PI; // faces you
  placed = true;
}

new GLTFLoader().load(${JSON.stringify('__URL__')}, (gltf) => {
  const m = gltf.scene;
  const box = new T.Box3().setFromObject(m);
  const size = box.getSize(new T.Vector3());
  const c = box.getCenter(new T.Vector3());
  const k = window.__cfg.scale;
  m.position.set(-c.x, -box.min.y, -c.z); // base on the ground, centred
  const holder = new T.Group(); holder.add(m); holder.scale.setScalar(k);
  holder.position.y = window.__cfg.height;
  holder.rotation.y = (window.__cfg.heading * Math.PI) / 180;
  model = new T.Group(); model.add(holder); anchor.add(model);
  const maxDim = Math.max(size.x, size.y, size.z) * k;
  cfg = { dist: Math.min(14, Math.max(0.9, maxDim * 2.2)) };
  // keep the whole thing in frame: if it is tall, push it back a little more
  cfg.dist = Math.max(cfg.dist, (size.y * k) / 0.9 + 1);
  if (haveOrientation) place(); else { camera.lookAt(0, EYE, -1); anchor.position.set(0, 0, -cfg.dist); placed = true; }
  post({ type: 'loaded', size: [size.x * k, size.y * k, size.z * k] });
}, undefined, (err) => post({ type: 'error', message: String(err && err.message || err) }));

let dragX = null;
renderer.domElement.addEventListener('touchstart', (ev) => { dragX = ev.touches[0].clientX; });
renderer.domElement.addEventListener('touchmove', (ev) => {
  if (dragX == null || !model) return;
  const x = ev.touches[0].clientX; spin += (x - dragX) * 0.012; dragX = x;
});
renderer.domElement.addEventListener('touchend', () => { dragX = null; });

renderer.setAnimationLoop(() => {
  if (haveOrientation) { camera.quaternion.slerp(qDevice, 0.35); }
  if (model) model.rotation.y = spin;
  renderer.render(scene, camera);
});
post({ type: 'ready' });
</script></body></html>`;

export function ModelView({ model, onState }) {
  const web = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [msg, setMsg] = useState('');

  const source = useMemo(() => {
    const cfg = { scale: model.scale ?? 1, heading: model.heading ?? 0, height: model.heightOffsetM ?? 0 };
    const page = html.replace('"__URL__"', JSON.stringify(model.url)).replace('<script type="module">', `<script>window.__cfg=${JSON.stringify(cfg)}</script><script type="module">`);
    return { html: page, baseUrl: getFeedBase() };
  }, [model]);

  useEffect(() => { onState?.(state); }, [state, onState]);

  // feed the phone's rotation to the page ~30 times a second
  useEffect(() => {
    DeviceMotion.setUpdateInterval(33);
    const sub = DeviceMotion.addListener((d) => {
      const r = d?.rotation;
      if (!r || !web.current) return;
      web.current.injectJavaScript(`window.setOrientation&&window.setOrientation(${r.alpha},${r.beta},${r.gamma});true;`);
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={state === 'ready' ? 'auto' : 'none'}>
      <WebView
        ref={web}
        style={styles.web}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        androidLayerType="hardware"
        mixedContentMode="always"
        backgroundColor="transparent"
        scrollEnabled={false}
        overScrollMode="never"
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === 'loaded') { setState('ready'); setMsg(m.size.map((n) => n.toFixed(1)).join(' × ') + ' m'); setTimeout(() => setMsg(''), 5000); }
            if (m.type === 'error') { setState('error'); setMsg(m.message); }
          } catch {}
        }}
        onError={(e) => { setState('error'); setMsg(e.nativeEvent?.description ?? 'WebView error'); }}
      />
      {state === 'loading' && (
        <View style={styles.chip} pointerEvents="none"><Text style={styles.chipText}>Loading 3D model…</Text></View>
      )}
      {state === 'ready' && !!msg && (
        <View style={styles.chip} pointerEvents="none"><Text style={styles.chipText}>Model loaded · {msg}. Look around for it.</Text></View>
      )}
      {state === 'error' && (
        <View style={styles.chip} pointerEvents="none"><Text style={styles.chipText} numberOfLines={2}>Could not load the model{msg ? `: ${msg}` : ''}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
  chip: { position: 'absolute', alignSelf: 'center', top: '42%', backgroundColor: '#000000B3', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, maxWidth: '86%' },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
