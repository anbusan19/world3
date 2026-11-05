import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapCard } from '../MapCard';
import { Stamp } from '../Stamp';
import { formatDistance } from '../geo';
import { CAPTURE_M, NEAR_METERS, shortName } from '../spots';
import { F, makeStyles, useColors } from '../theme';

export function Home({ spots, user, collected, openSpot, setScrollLock }) {
  const styles = useStyles();
  const C = useColors();
  const [selectedId, setSelectedId] = useState(spots[0].id);

  // the nearest spot you have not collected yet (falls back to list order when there is no GPS fix)
  const todo = spots.filter((s) => collected[s.id] == null);
  const next = [...todo].sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))[0];

  return (
    <>
      <Text style={styles.eyebrow}>YOUR WORLD, COLLECTED</Text>
      <Text style={styles.title}>
        Go there.{'\n'}
        <Text style={styles.titleLight}>Prove it.</Text>
      </Text>

      <View style={styles.heading}>
        <Text style={styles.headingTitle}>Around you</Text>
        <Text style={styles.headingMeta}>real map</Text>
      </View>
      <MapCard spots={spots} user={user} selectedId={selectedId} onSelect={setSelectedId} setScrollLock={setScrollLock} />

      <View style={styles.heading}>
        <Text style={styles.headingTitle}>Nearby spots</Text>
        <Text style={styles.headingMeta}>{spots.length} discovered</Text>
      </View>

      {spots.map((s) => {
        const near = s.dist != null && s.dist <= NEAR_METERS;
        const away = formatDistance(s.dist);
        const got = collected[s.id] != null;
        return (
          <Pressable key={s.id} style={styles.row} onPress={() => openSpot(s)}>
            <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} holeColor={C.card} iconSize={26} labelSize={8} holes={7} style={styles.rowStamp} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.rowMeta}>{away ? `${s.type} · ${away}` : s.type}</Text>
            </View>
            <View style={[styles.pill, (near || got) && styles.pillNear]}>
              <Text style={[styles.pillText, (near || got) && styles.pillTextNear]}>{got ? 'Collected' : s.dist == null ? '—' : near ? 'Near' : 'Far'}</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.capture}>
        <View style={styles.captureTop}>
          <Text style={styles.captureKicker}>NEXT STAMP</Text>
          <Ionicons name={next ? 'lock-closed' : 'checkmark-circle'} size={18} color={C.green} />
        </View>
        <Text style={styles.captureTitle}>{next ? next.name : 'All collected.'}</Text>
        <Text style={styles.captureCopy}>
          {next ? `Get within ${CAPTURE_M} m to unlock your capture.` : 'Every spot is in your passport.'}
        </Text>
        {next && (
          <Pressable style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.85 }]} onPress={() => openSpot(next)}>
            <Text style={styles.captureBtnText}>Open spot</Text>
            <Ionicons name="arrow-forward" size={18} color="#0B0B0F" />
          </Pressable>
        )}
      </View>
    </>
  );
}

const useStyles = makeStyles((C) => ({
  eyebrow: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: C.info },
  title: { fontFamily: F.black, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, color: C.ink, marginTop: 8, marginBottom: 20 },
  titleLight: { fontFamily: F.med, color: C.ink },

  heading: { marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headingTitle: { fontFamily: F.black, fontSize: 20, color: C.ink, letterSpacing: -0.4 },
  headingMeta: { fontFamily: F.med, fontSize: 12, color: C.muted },

  row: { backgroundColor: C.card, borderRadius: 22, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  rowStamp: { width: 58, height: 71 },
  rowInfo: { flex: 1, paddingHorizontal: 13 },
  rowName: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  rowMeta: { fontFamily: F.med, fontSize: 11, color: C.muted, marginTop: 4 },
  pill: { paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: C.soft, justifyContent: 'center' },
  pillNear: { backgroundColor: C.green },
  pillText: { fontFamily: F.bold, fontSize: 11, color: C.muted },
  pillTextNear: { color: '#0B0B0F' },

  capture: { backgroundColor: C.panel, borderRadius: 28, padding: 20, marginTop: 14 },
  captureTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  captureKicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: C.green },
  captureTitle: { fontFamily: F.black, fontSize: 24, color: '#fff', letterSpacing: -0.5, marginTop: 10 },
  captureCopy: { fontFamily: F.med, fontSize: 13, color: '#B9BCC6', marginTop: 6 },
  captureBtn: { height: 52, borderRadius: 26, backgroundColor: C.green, marginTop: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captureBtnText: { fontFamily: F.bold, fontSize: 14, color: '#0B0B0F' },
}));
