import { memo, useEffect, useRef, useState } from 'react';
import { usePhoneSize as useWindowDimensions } from './phoneSize';
import { Animated, BackHandler, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from './Stamp';
import { IntroHero, PassportHero } from './art/OnboardingArt';
import { ACCENT, F, makeStyles, useColors } from './theme';

// Frontend only: three slides, buttons just move forward. Nothing is saved.
// Slide 1 is a globe + map, slide 2 is tilted stamps (on coloured tiles, with icon badges and a curved arrow),
// slide 3 is a passport. Each slide has either a `hero` (globe / passport) or a list of stamp `items`.
export const SLIDES = [
  {
    title: 'Go there.',
    titleLight: 'Prove it.',
    copy: 'Visit real landmarks and event spots around you.',
    hero: 'globe',
    items: [],
    badges: [],
    arcs: [],
  },
  {
    title: 'Capture Stamps.',
    titleLight: 'Be really there.',
    copy: 'Stand in the right place to capture a collectible stamp.',
    items: [
      { art: 'ethglobal', icon: 'ticket', label: 'ETHGLOBAL', theme: 'sky', tile: ACCENT.sun, rot: 8, left: '48%', top: '0%' },
      { art: 'gateway', icon: 'business', label: 'GATEWAY', theme: 'coral', tile: ACCENT.sky, rot: -7, left: '6%', top: '42%' },
    ],
    badges: [
      { icon: 'navigate', bg: ACCENT.green, color: '#0B0B0F', left: '10%', top: '12%' },
      { icon: 'checkmark', bg: 'solid', color: 'onSolid', left: '78%', top: '52%' },
    ],
    arcs: [
      { color: ACCENT.green, left: '22%', top: '6%', rot: 90 },
      { color: ACCENT.blue, left: '58%', top: '48%', rot: 270 },
    ],
  },
  {
    title: 'Keep your Passport.',
    titleLight: 'Show it off.',
    copy: 'Every stamp you collect lives in one place, yours to keep.',
    hero: 'passport',
    items: [],
    badges: [],
    arcs: [],
  },
];

export function Art({ slide }) {
  const styles = useStyles();
  const C = useColors();
  if (slide.hero === 'globe') return <View style={styles.art}><IntroHero /></View>;
  if (slide.hero === 'passport') return <View style={[styles.art, styles.artCenter]}><PassportHero /></View>;
  return (
    <View style={styles.art}>
      {slide.arcs.map((a, i) => (
        <View
          key={`a${i}`}
          style={[styles.arc, { borderTopColor: a.color, borderRightColor: a.color, left: a.left, top: a.top, transform: [{ rotate: `${a.rot}deg` }] }]}
        />
      ))}
      {slide.items.map((it, i) => (
        <View key={`s${i}`} style={[styles.item, { left: it.left, top: it.top }]}>
          <View style={[styles.tile, { backgroundColor: it.tile, transform: [{ translateX: 18 }, { translateY: 16 }, { rotate: `${-it.rot}deg` }] }]} />
          <Stamp
            theme={it.theme}
            art={it.art}
            icon={it.icon}
            label={it.label}
            iconSize={54}
            labelSize={15}
            style={{ transform: [{ rotate: `${it.rot}deg` }] }}
          />
        </View>
      ))}
      {slide.badges.map((b, i) => (
        <View key={`b${i}`} style={[styles.badge, { backgroundColor: b.bg === 'solid' ? C.solid : b.bg, left: b.left, top: b.top }]}>
          <Ionicons name={b.icon} size={20} color={b.color === 'onSolid' ? C.onSolid : b.color} />
        </View>
      ))}
    </View>
  );
}

// One slide. Memoised so changing the current page never re-renders the (heavy) artwork: while the pager moves,
// nothing here is recomputed, the whole strip is just translated by the GPU.
const Page = memo(function Page({ slide, width, top }) {
  const styles = useStyles();
  // the globe slide runs right up to the top of the screen; the others start below the buttons
  return (
    <View style={[styles.page, { width, paddingTop: slide.hero === 'globe' ? 0 : top }]}>
      <Art slide={slide} />
      <Text style={[styles.title, slide.hero === 'globe' && styles.titleBig]}>
        {slide.title}
        {'\n'}
        <Text style={styles.titleLight}>{slide.titleLight}</Text>
      </Text>
      <Text style={styles.copy}>{slide.copy}</Text>
    </View>
  );
});

const DOT = 8;
const SLOT = 26; // each page indicator owns a slot as wide as the active pill, so the pill never hides a neighbour
const GAP = 6;
const clamp = (n) => Math.max(0, Math.min(SLIDES.length - 1, n));

export function Onboarding({ onDone }) {
  const styles = useStyles();
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const C = useColors();
  const [index, setIndex] = useState(0);
  const x = useRef(new Animated.Value(0)).current; // horizontal position of the whole strip, in px (0, -W, -2W)
  const startX = useRef(0);
  const last = index === SLIDES.length - 1;

  // Glide to a page. Critically damped spring (no bounce) that carries over the speed of the swipe.
  const settle = (target, vx = 0) => {
    setIndex(target);
    Animated.spring(x, { toValue: -target * W, velocity: vx, bounciness: 0, speed: 14, useNativeDriver: true }).start();
  };
  const go = (delta) => {
    const t = clamp(index + delta);
    if (t !== index) settle(t);
  };

  // The swipe handler is created once, so it reads the latest values through this ref.
  const nav = useRef({});
  nav.current = { index, W, settle };

  const pan = useRef(
    PanResponder.create({
      // only claim clearly horizontal drags, so taps on the buttons still work
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        x.stopAnimation();
        startX.current = -nav.current.index * nav.current.W;
        x.setValue(startX.current);
      },
      onPanResponderMove: (_, g) => {
        const { index: i } = nav.current;
        const atEdge = (g.dx > 0 && i === 0) || (g.dx < 0 && i === SLIDES.length - 1);
        x.setValue(startX.current + g.dx * (atEdge ? 0.25 : 1)); // the page follows the finger; resists past the ends
      },
      onPanResponderRelease: (_, g) => {
        const { index: i, W: w, settle: go2 } = nav.current;
        const flick = Math.abs(g.vx) > 0.4;
        let t = i;
        if (g.dx < -w * 0.18 || (flick && g.dx < -16)) t = i + 1;
        else if (g.dx > w * 0.18 || (flick && g.dx > 16)) t = i - 1;
        go2(clamp(t), g.vx);
      },
      onPanResponderTerminate: () => nav.current.settle(nav.current.index),
    }),
  ).current;

  // Android back button steps back through the slides; on the first slide it keeps its normal behaviour.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      go(-1);
      return true;
    });
    return () => sub.remove();
  }, [index]);

  const next = () => (last ? onDone() : go(1));

  // the active-page pill glides between the dots, driven by the same position as the slides
  const input = SLIDES.map((_, i) => -(SLIDES.length - 1 - i) * W);
  const output = SLIDES.map((_, i) => (SLIDES.length - 1 - i) * (SLOT + GAP));
  const pillX = x.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']} {...pan.panHandlers}>
      <View style={[styles.topRow, { top: insets.top }]}>
        {index > 0 ? (
          <Pressable style={styles.backBtn} onPress={() => go(-1)} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={C.ink} />
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        {!last && (
          <Pressable style={styles.skip} onPress={onDone} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.pager}>
        <Animated.View style={[styles.track, { width: W * SLIDES.length, transform: [{ translateX: x }] }]}>
          {SLIDES.map((s, i) => (
            <Page key={i} slide={s} width={W} top={insets.top + 56} />
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={styles.slot}>
              <View style={styles.dot} />
            </View>
          ))}
          <Animated.View style={[styles.pill, { transform: [{ translateX: pillX }] }]} />
        </View>
        <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]} onPress={next}>
          <Text style={styles.ctaText}>{last ? 'Get Started' : 'Next'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((C) => ({
  safe: { flex: 1, backgroundColor: C.bg },

  topRow: { position: 'absolute', left: 0, right: 0, zIndex: 5, height: 56, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  backSpacer: { width: 46, height: 46 },
  skip: { paddingHorizontal: 16, height: 38, borderRadius: 19, backgroundColor: C.card, justifyContent: 'center' },
  skipText: { fontFamily: F.semi, fontSize: 13, color: C.ink },

  pager: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  page: { paddingHorizontal: 22 },
  art: { flex: 1, minHeight: 280, marginBottom: 12 },
  artCenter: { justifyContent: 'center' },
  item: { position: 'absolute', width: '46%', aspectRatio: 0.82 },
  tile: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 30 },
  badge: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  arc: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderBottomColor: 'transparent', borderLeftColor: 'transparent' },

  eyebrow: { fontFamily: F.semi, fontSize: 11, letterSpacing: 1.6, color: C.info, marginBottom: 12 },
  titleBig: { fontSize: 46, lineHeight: 48, letterSpacing: -2 },
  title: { fontFamily: F.bold, fontSize: 34, lineHeight: 39, letterSpacing: -0.8, color: C.ink },
  titleLight: { fontFamily: F.reg },
  copy: { fontFamily: F.reg, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 10, maxWidth: 320 },

  footer: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14 },
  dots: { flexDirection: 'row', gap: GAP, marginBottom: 18, height: DOT },
  slot: { width: SLOT, height: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#D5D8E0' },
  pill: { position: 'absolute', left: 0, top: 0, width: SLOT, height: DOT, borderRadius: DOT / 2, backgroundColor: C.solid },
  cta: { height: 62, borderRadius: 31, backgroundColor: C.solid, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: F.semi, fontSize: 17, color: C.onSolid },
}));
