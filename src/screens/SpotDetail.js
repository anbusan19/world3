import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from '../Stamp';
import { BackButton, Chip, InfoRow, PrimaryButton } from '../ui';
import { formatDistance } from '../geo';
import { APPROACH_M, CAPTURE_M, shortName, spotState } from '../spots';
import { F, makeStyles, useColors } from '../theme';

const STATES = [
  { key: 'far', label: 'Far', body: 'A map pin and a direction arrow. The model is not shown yet.' },
  { key: 'approaching', label: 'Approaching', body: 'The model appears in AR, dimmed and locked.' },
  { key: 'zone', label: 'Capture zone', body: 'The model is solid and tappable. Capture is enabled.' },
];

// Spot page. `spot.dist` (metres, or null) is the real GPS distance. The "Preview state" switch is a design aid so
// every state can be seen without walking to the place; it starts on whatever the real distance says.
export function SpotDetail({ spot, collectedAt, onBack, onCapture, onOpenStamp }) {
  const styles = useStyles();
  const C = useColors();
  const [state, setState] = useState(spotState(spot.dist, spot));
  const done = collectedAt != null;
  const idx = STATES.findIndex((s) => s.key === state);
  const away = formatDistance(spot.dist);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton onPress={onBack} />
        <Text style={styles.topTitle}>Spot</Text>
        <View style={{ width: 46 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Stamp
            theme={spot.theme}
            art={spot.art}
            icon={spot.icon}
            label={shortName(spot)}
            tag={spot.id}
            locked={!done && state !== 'zone'}
            iconSize={72}
            labelSize={18}
            holes={12}
            style={[styles.bigStamp, state === 'approaching' && !done && { opacity: 0.7 }]}
          />
        </View>

        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.sub}>
          {spot.city} · {spot.type === 'EVENT' ? 'Event spot' : 'Landmark'}
        </Text>
        <View style={styles.chipRow}>
          <Chip icon={spot.kind === 'anchor' ? 'qr-code' : 'camera'} label={spot.kind === 'anchor' ? 'Anchor spot · scan QR' : 'Geospatial spot'} />
          <Chip icon="navigate" label={away ? `${away} away` : 'Distance needs GPS'} />
        </View>

        {/* distance state */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Where you are</Text>
            <Text style={styles.preview}>PREVIEW STATE</Text>
          </View>
          <View style={styles.track}>
            {STATES.map((s, i) => (
              <Pressable key={s.key} style={styles.seg} onPress={() => setState(s.key)}>
                <View style={[styles.bar, i <= idx && styles.barOn]} />
                <Text style={[styles.segText, i === idx && styles.segTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.stateBody}>{STATES[idx].body}</Text>
          <Text style={styles.rules}>
            Approaching starts within about {spot.approachM ?? APPROACH_M} m. The capture zone is within {spot.captureM ?? CAPTURE_M} m.
          </Text>
        </View>

        {done ? (
          <PrimaryButton label="View your stamp" icon="albums" onPress={onOpenStamp} style={{ marginTop: 16 }} />
        ) : (
          <>
            <PrimaryButton
              label={state === 'zone' ? 'Capture' : state === 'approaching' ? 'Find it in AR' : 'Capture locked'}
              icon={state === 'zone' ? 'scan' : state === 'approaching' ? 'camera' : 'lock-closed'}
              tone="green"
              disabled={state === 'far'}
              onPress={onCapture}
              style={{ marginTop: 16 }}
            />
            {state !== 'zone' && (
              <Text style={styles.why}>
                Too far. Get within {spot.captureM ?? CAPTURE_M} m of the spot to capture it{state === 'approaching' ? ' (you are close).' : '.'}
              </Text>
            )}
          </>
        )}

        <Text style={styles.section}>How we know you were here</Text>
        <InfoRow
          icon={spot.kind === 'anchor' ? 'qr-code-outline' : 'camera-outline'}
          title={spot.kind === 'anchor' ? 'Scan the QR at the venue' : 'Camera-based location fix'}
          body={
            spot.kind === 'anchor'
              ? 'Indoors, a rotating code at the venue places you. A photo of yesterday’s code will not work.'
              : 'GPS blended with the camera image, which is far harder to fake than GPS alone.'
          }
        />
        <InfoRow icon="shield-checkmark-outline" title="World ID: one human, one stamp" body="Proves you are a unique person without revealing who you are." />
        <InfoRow icon="server-outline" title="The backend decides" body="Your phone only sends evidence. The server re-checks distance, accuracy and the proof." />
        <InfoRow icon="eye-off-outline" tint={C.orange} title="Exact coordinates never go onchain" body="Only the spot name and time are stored with your stamp." />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((C) => ({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { height: 62, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: F.semi, fontSize: 16, color: C.ink },
  content: { paddingHorizontal: 22, paddingBottom: 40 },

  hero: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  bigStamp: { width: 190, transform: [{ rotate: '-4deg' }] },

  name: { fontFamily: F.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.6, color: C.ink, textAlign: 'center', marginTop: 10 },
  sub: { fontFamily: F.reg, fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14, marginBottom: 20 },

  card: { backgroundColor: C.card, borderRadius: 24, padding: 18 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  preview: { fontFamily: F.semi, fontSize: 9, letterSpacing: 1.2, color: C.muted },
  track: { flexDirection: 'row', gap: 6, marginTop: 16 },
  seg: { flex: 1 },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.line },
  barOn: { backgroundColor: C.green },
  segText: { fontFamily: F.reg, fontSize: 11, color: C.muted, marginTop: 7 },
  segTextOn: { fontFamily: F.semi, color: C.ink },
  stateBody: { fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 14 },
  rules: { fontFamily: F.reg, fontSize: 11, color: C.muted, marginTop: 8 },

  why: { fontFamily: F.reg, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 10 },
  section: { fontFamily: F.bold, fontSize: 20, letterSpacing: -0.4, color: C.ink, marginTop: 30, marginBottom: 12 },
}));
