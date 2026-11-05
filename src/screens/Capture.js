import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from '../Stamp';
import { ArCamera } from './ArCamera';
import { BackButton, Chip, PrimaryButton } from '../ui';
import { CAPTURE_M, shortName } from '../spots';
import { F, makeStyles, useColors, useTheme } from '../theme';

// FRONTEND ONLY. The camera step is real (see ArCamera.js); World ID and the backend are not. It shows the three steps
// of the capture flow (camera, human check, result) and every outcome the README lists, so the design can be reviewed.

const PROGRESS = ['Requesting a one-time code', 'Verifying your World ID proof', 'Backend checking your location', 'Minting your stamp'];

const OUTCOMES = [
  { key: 'success', label: 'Success' },
  { key: 'unverified', label: 'Not verified', failAt: 1, icon: 'person-remove', title: 'Not verified', body: 'We could not confirm you are a unique human. Verify with World ID and try again.' },
  { key: 'repeat', label: 'Already captured', failAt: 2, icon: 'repeat', title: 'Already captured', body: 'One human can capture each spot once. This one is already in your passport.' },
  { key: 'far', label: 'Too far', failAt: 2, icon: 'walk', title: 'Too far', body: `The server measured you outside the ${CAPTURE_M} m capture zone. Move closer and try again.` },
  { key: 'gps', label: 'Poor GPS', failAt: 2, icon: 'cellular', title: 'Poor GPS signal', body: 'Your location was not accurate enough. Improve your signal, for example by stepping into the open, and try again.' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function Capture({ spot, user, onClose, onSuccess, onViewPassport, registerBack }) {
  const [step, setStep] = useState('ar'); // 'ar' | 'verify' | 'result'
  const [outcome, setOutcome] = useState('success');
  const [run, setRun] = useState(null); // { i, failed } while the checklist is running
  const [result, setResult] = useState(null); // 'success' or an OUTCOMES entry
  const alive = useRef(true);

  // set true on every (re)mount: React re-runs effects in dev and on Fast Refresh, and a stale `false` would stop the run
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Android back: step back inside the flow before leaving it.
  useEffect(() => {
    registerBack?.(() => {
      if (run) return true; // busy
      if (step === 'verify') { setStep('ar'); return true; }
      return false;
    });
    return () => registerBack?.(null);
  }, [step, run, registerBack]);

  async function start() {
    const out = OUTCOMES.find((o) => o.key === outcome);
    for (let i = 0; i < PROGRESS.length; i++) {
      setRun({ i, failed: false });
      await wait(750);
      if (!alive.current) return;
      if (out.failAt === i) {
        setRun({ i, failed: true });
        await wait(900);
        if (!alive.current) return;
        setResult(out);
        setStep('result');
        setRun(null);
        return;
      }
    }
    setRun({ i: PROGRESS.length, failed: false });
    await wait(500);
    if (!alive.current) return;
    onSuccess(spot);
    setResult('success');
    setStep('result');
    setRun(null);
  }

  if (step === 'ar') return <ArCamera spot={spot} user={user} onClose={onClose} onCapture={() => setStep('verify')} />;
  if (step === 'verify') {
    return (
      <VerifyStep
        spot={spot}
        outcome={outcome}
        setOutcome={setOutcome}
        run={run}
        onBack={() => setStep('ar')}
        onStart={start}
      />
    );
  }
  return (
    <ResultStep
      spot={spot}
      result={result}
      onRetry={() => { setResult(null); setStep('verify'); }}
      onClose={onClose}
      onViewPassport={onViewPassport}
    />
  );
}

/* --------------------------------- Verify -------------------------------- */

function VerifyStep({ spot, outcome, setOutcome, run, onBack, onStart }) {
  const { isDark } = useTheme();
  const styles = useStyles();
  const C = useColors();
  const busy = !!run;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.top}>
        {busy ? <View style={{ width: 46 }} /> : <BackButton onPress={onBack} />}
        <Text style={styles.topTitle}>Verify</Text>
        <View style={{ width: 46 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.wid}>
          <View style={styles.widRing3}>
            <View style={styles.widRing2}>
              <View style={styles.widCore}>
                <Ionicons name="finger-print" size={34} color={C.onSolid} />
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.title}>Verify you’re human.</Text>
        <Text style={styles.copy}>
          One human, one stamp. World ID proves you’re a unique person for <Text style={styles.bold}>{spot.name}</Text> without telling us who you are.
        </Text>
        <View style={styles.chips}>
          <Chip icon="ribbon" label="Proof of Human" />
          <Chip icon="pin" label="Tied to this spot" />
          <Chip icon="wallet" label="Bound to your wallet" />
        </View>

        {run ? (
          <View style={styles.list}>
            {PROGRESS.map((label, i) => {
              const done = run.i > i;
              const current = run.i === i;
              const failed = current && run.failed;
              return (
                <View key={label} style={styles.stepRow}>
                  <View style={[styles.stepIcon, done && { backgroundColor: C.green }, failed && { backgroundColor: C.orange }]}>
                    {done && <Ionicons name="checkmark" size={16} color="#0B0B0F" />}
                    {failed && <Ionicons name="close" size={16} color="#fff" />}
                    {current && !failed && <ActivityIndicator size="small" color={C.ink} />}
                  </View>
                  <Text style={[styles.stepText, (done || current) && { color: C.ink, fontFamily: F.bold }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <>
            <PrimaryButton label="Verify with World ID" icon="shield-checkmark" onPress={onStart} style={{ marginTop: 26 }} />
            <Text style={styles.small}>Your phone sends evidence. The server decides.</Text>

            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>PREVIEW OUTCOME</Text>
              <View style={styles.previewRow}>
                {OUTCOMES.map((o) => (
                  <Pressable key={o.key} onPress={() => setOutcome(o.key)} style={[styles.pChip, outcome === o.key && styles.pChipOn]}>
                    <Text style={[styles.pText, outcome === o.key && { color: C.onSolid }]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.previewNote}>Design aid: pick what happens, then verify. Nothing is checked for real.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* --------------------------------- Result -------------------------------- */

function ResultStep({ spot, result, onRetry, onClose, onViewPassport }) {
  const { isDark } = useTheme();
  const styles = useStyles();
  const C = useColors();
  const pop = useRef(new Animated.Value(0)).current;
  const ok = result === 'success';

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
  }, [pop]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.top}>
        <View style={{ width: 46 }} />
        <Text style={styles.topTitle}>{ok ? 'Captured' : 'Not captured'}</Text>
        <View style={{ width: 46 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>
        {ok ? (
          <>
            <Animated.View style={{ transform: [{ scale }], marginTop: 8 }}>
              <View style={styles.burst}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <View key={i} style={[styles.spark, { backgroundColor: [C.orange, C.green, C.blue, '#F4D35E'][i % 4], transform: [{ rotate: `${i * 45}deg` }, { translateY: -128 }] }]} />
                ))}
                <Stamp theme={spot.theme} art={spot.art} icon={spot.icon} label={shortName(spot)} tag={spot.id} iconSize={72} labelSize={18} holes={12} style={{ width: 190, transform: [{ rotate: '-4deg' }] }} />
              </View>
            </Animated.View>
            <Text style={styles.rTitle}>Stamp collected.</Text>
            <Text style={styles.rBody}>{spot.name} is now in your passport.</Text>
            <View style={styles.tx}>
              <Text style={styles.txLabel}>MINT (PREVIEW)</Text>
              <Text style={styles.mono}>token #{spot.id.padStart(4, '0')} · Sepolia</Text>
            </View>
            <PrimaryButton label="View passport" icon="person" onPress={onViewPassport} style={{ alignSelf: 'stretch', marginTop: 24 }} />
            <PrimaryButton label="Keep exploring" tone="light" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          </>
        ) : (
          <>
            <Animated.View style={[styles.fail, { transform: [{ scale }] }]}>
              <Ionicons name={result.icon} size={44} color="#fff" />
            </Animated.View>
            <Text style={styles.rTitle}>{result.title}</Text>
            <Text style={styles.rBody}>{result.body}</Text>
            <View style={styles.nothing}>
              <Ionicons name="shield-checkmark" size={16} color="#0B0B0F" />
              <Text style={styles.nothingText}>Nothing was minted.</Text>
            </View>
            <PrimaryButton label="Try again" icon="refresh" onPress={onRetry} style={{ alignSelf: 'stretch', marginTop: 24 }} />
            <PrimaryButton label="Close" tone="light" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* --------------------------------- styles -------------------------------- */

const useStyles = makeStyles((C) => ({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { height: 62, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  content: { paddingHorizontal: 22, paddingBottom: 40 },

  wid: { alignItems: 'center', marginTop: 10, marginBottom: 22 },
  widRing3: { width: 150, height: 150, borderRadius: 75, backgroundColor: C.blue + '14', alignItems: 'center', justifyContent: 'center' },
  widRing2: { width: 112, height: 112, borderRadius: 56, backgroundColor: C.blue + '26', alignItems: 'center', justifyContent: 'center' },
  widCore: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.solid, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.black, fontSize: 30, letterSpacing: -0.8, color: C.ink, textAlign: 'center' },
  copy: { fontFamily: F.med, fontSize: 14, lineHeight: 21, color: C.muted, textAlign: 'center', marginTop: 10 },
  bold: { fontFamily: F.bold, color: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  small: { fontFamily: F.med, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 10 },

  list: { marginTop: 28, backgroundColor: C.card, borderRadius: 24, padding: 18, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontFamily: F.med, fontSize: 14, color: C.muted },

  previewBox: { marginTop: 26, padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9CDD8' },
  previewTitle: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.2, color: C.muted },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pChip: { paddingHorizontal: 13, height: 32, borderRadius: 16, backgroundColor: C.card, justifyContent: 'center' },
  pChipOn: { backgroundColor: C.solid },
  pText: { fontFamily: F.bold, fontSize: 12, color: C.ink },
  previewNote: { fontFamily: F.med, fontSize: 11, color: C.muted, marginTop: 12 },

  burst: { width: 260, height: 290, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  rTitle: { fontFamily: F.black, fontSize: 30, letterSpacing: -0.8, color: C.ink, marginTop: 14, textAlign: 'center' },
  rBody: { fontFamily: F.med, fontSize: 14, lineHeight: 21, color: C.muted, marginTop: 8, textAlign: 'center', paddingHorizontal: 10 },
  tx: { marginTop: 18, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
  txLabel: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1.2, color: C.muted },
  mono: { fontFamily: 'monospace', fontSize: 12, color: C.ink, marginTop: 4 },
  fail: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  nothing: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.green, paddingHorizontal: 14, height: 34, borderRadius: 17, marginTop: 18 },
  nothingText: { fontFamily: F.bold, fontSize: 12, color: '#0B0B0F' },
}));
