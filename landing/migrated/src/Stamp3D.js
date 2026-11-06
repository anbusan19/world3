import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Stamp, StampOutline } from './Stamp';
import { shortName } from './spots';
import { F, STAMP_THEMES } from './theme';

// A collectible that looks three-dimensional without needing a 3D model: a two-sided card that spins around its
// vertical axis with perspective, a postmark on the back, a few layered strips so it has thickness when it is
// edge-on, and a floor shadow that narrows as it turns. Drag to spin it (it keeps its momentum), tap to capture.
// All the motion runs on the native thread.

const SLABS = 5; // edge layers that give the card its thickness
const RANGE = 900; // the angle is kept inside +-RANGE degrees so every lookup table below covers it
const SWEEP = Array.from({ length: (RANGE * 2) / 90 + 1 }, (_, i) => -RANGE + i * 90);
const sine = (k) => SWEEP.map((a) => Math.round(Math.sin((a * Math.PI) / 180)) * k); // sin(angle) sampled every 90 degrees
const squash = SWEEP.map((a) => (Math.abs(Math.round(Math.cos((a * Math.PI) / 180))) === 1 ? 1 : 0.28)); // how wide the card looks
// 0 while the card faces you, rising to 1 once it is clearly turned (sampled every 15 degrees)
const FINE = Array.from({ length: (RANGE * 2) / 15 + 1 }, (_, i) => -RANGE + i * 15);
const EDGE = FINE.map((a) => Math.min(1, Math.max(0, (Math.abs(Math.sin((a * Math.PI) / 180)) - 0.25) / 0.45)));
const LOGO = require('../assets/stamplogo-dark.png');
const rand = (a, b) => a + Math.random() * (b - a);

function Back({ w, h, spot }) {
  const t = STAMP_THEMES[spot.theme] ?? STAMP_THEMES.coral;
  const pad = Math.max(4, w * 0.05);
  return (
    <View style={{ width: w, height: h }}>
      <StampOutline w={w} h={h} color="#F3E8CF" />
      <View style={[styles.backInner, { left: pad, top: pad, right: pad, bottom: pad, borderColor: t.frame }]}>
        <Image source={LOGO} style={{ width: w * 0.46, height: w * 0.46 }} resizeMode="contain" />
        <Text style={[styles.backNo, { fontSize: w * 0.062, color: t.accent }]}>STAMP #{spot.id.padStart(4, '0')}</Text>
        <Text style={[styles.backName, { fontSize: w * 0.05 }]} numberOfLines={2}>{spot.name}</Text>
        <Text style={[styles.backFine, { fontSize: w * 0.034 }]}>NON-TRANSFERABLE · SEPOLIA</Text>
      </View>
    </View>
  );
}

export function Stamp3D({ spot, width = 220, onPress }) {
  const height = Math.round(width / 0.82);
  const t = STAMP_THEMES[spot.theme] ?? STAMP_THEMES.coral;
  const rot = useRef(new Animated.Value(0)).current; // degrees around the vertical axis
  const bob = useRef(new Animated.Value(0)).current; // gentle hover
  const cur = useRef(0);
  const startAt = useRef(0);
  const moved = useRef(false);
  const idle = useRef(null);
  const touching = useRef(false);

  useEffect(() => {
    const id = rot.addListener(({ value }) => { cur.current = value; });
    return () => rot.removeListener(id);
  }, [rot]);

  // slow sway around `base` while nobody is touching it
  const sway = (base) => {
    idle.current?.stop();
    idle.current = Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: base + 26, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rot, { toValue: base - 26, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    idle.current.start();
  };
  // after a spin, glide to the nearest face-on position, then sway again
  const settle = () => {
    const base = Math.round(cur.current / 180) * 180; // either face can be left showing
    Animated.spring(rot, { toValue: base, bounciness: 3, speed: 9, useNativeDriver: true }).start(() => sway(base));
  };

  // every few seconds, flip over by a random number of half turns so the back (with the logo) gets shown too
  const flipTimer = useRef(null);
  const scheduleFlip = () => {
    clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => {
      if (touching.current) return scheduleFlip();
      idle.current?.stop();
      rot.stopAnimation((v) => {
        // keep the angle in a range the lookup tables cover: wrap by whole turns, which looks identical
        let from = v;
        while (from > 180) from -= 360;
        while (from < -180) from += 360;
        rot.setValue(from);
        const turns = Math.ceil(rand(0.4, 2.4)); // 1, 2 or 3 half turns, so it lands on the back about half the time
        const to = Math.round(from / 180) * 180 + (Math.random() < 0.5 ? -1 : 1) * turns * 180;
        Animated.timing(rot, { toValue: to, duration: 700 + turns * 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
          if (!finished) return;
          sway(to);
          scheduleFlip();
        });
      });
    }, rand(2600, 5200));
  };

  useEffect(() => {
    sway(0);
    scheduleFlip();
    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    hover.start();
    return () => { idle.current?.stop(); hover.stop(); clearTimeout(flipTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const press = useRef(onPress);
  press.current = onPress;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        touching.current = true;
        clearTimeout(flipTimer.current);
        idle.current?.stop();
        rot.stopAnimation();
        startAt.current = cur.current;
        moved.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 6) moved.current = true;
        rot.setValue(startAt.current + g.dx * 0.8);
      },
      onPanResponderRelease: (_, g) => {
        touching.current = false;
        if (!moved.current) {
          settle();
          scheduleFlip();
          press.current?.();
          return;
        }
        Animated.decay(rot, { velocity: g.vx * 0.8, deceleration: 0.996, useNativeDriver: true }).start(() => { settle(); scheduleFlip(); });
      },
      onPanResponderTerminate: () => { touching.current = false; settle(); scheduleFlip(); },
    }),
  ).current;

  const spin = rot.interpolate({ inputRange: [-RANGE, RANGE], outputRange: [`${-RANGE}deg`, `${RANGE}deg`], extrapolate: 'extend' });
  const spinBack = rot.interpolate({ inputRange: [-RANGE, RANGE], outputRange: [`${-RANGE + 180}deg`, `${RANGE + 180}deg`], extrapolate: 'extend' });
  const hoverY = bob.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const shadowW = rot.interpolate({ inputRange: SWEEP, outputRange: squash, extrapolate: 'extend' });
  const edge = Array.from({ length: SLABS }, (_, i) =>
    rot.interpolate({ inputRange: FINE, outputRange: EDGE.map((f) => f * (0.6 + i * 0.08)), extrapolate: 'extend' }),
  );

  return (
    <View style={{ width, alignItems: 'center' }} {...pan.panHandlers}>
      <Animated.View style={{ width, height, transform: [{ translateY: hoverY }] }}>
        {/* thickness: strips that fan out sideways as the card turns edge-on */}
        {Array.from({ length: SLABS }, (_, i) => {
          const shift = rot.interpolate({ inputRange: SWEEP, outputRange: sine((i + 1) * 1.7), extrapolate: 'extend' });
          return (
            <Animated.View
              key={i}
              style={[
                styles.slab,
                { width, height, opacity: edge[i], transform: [{ perspective: 1100 }, { translateX: shift }, { rotateY: spin }] },
              ]}
            >
              <StampOutline w={width} h={height} color={t.accent} />
            </Animated.View>
          );
        })}
        <Animated.View style={[styles.face, { transform: [{ perspective: 1100 }, { rotateY: spinBack }] }]}>
          <Back w={width} h={height} spot={spot} />
        </Animated.View>
        <Animated.View style={[styles.face, { transform: [{ perspective: 1100 }, { rotateY: spin }] }]}>
          <Stamp theme={spot.theme} art={spot.art} icon={spot.icon} label={shortName(spot)} tag={spot.id} iconSize={64} labelSize={16} style={{ width }} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.shadow, { width: width * 0.7, transform: [{ scaleX: shadowW }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', left: 0, top: 0, backfaceVisibility: 'hidden' },
  slab: { position: 'absolute', left: 0, top: 0 },
  shadow: { height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.26)', marginTop: 34 },
  backInner: { position: 'absolute', borderRadius: 3, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 8 },
  backNo: { fontFamily: F.black, letterSpacing: 1.5, marginTop: 14 },
  backName: { fontFamily: F.med, color: '#8A7F68', marginTop: 4, textAlign: 'center' },
  backFine: { fontFamily: F.bold, letterSpacing: 1, color: '#B7AA8E', marginTop: 12 },
});
