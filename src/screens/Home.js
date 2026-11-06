import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MapCard } from '../MapCard';
import { Stamp } from '../Stamp';
import { formatDistance } from '../geo';
import { NEAR_METERS, shortName } from '../spots';
import { F, makeStyles, useColors } from '../theme';

// Explore: the real map fills the whole screen, and the words sit on top of it. A strip of spot cards floats above the
// tab bar; tapping one flies the map there, and its arrow opens the spot.
export function Home({ spots, user, collected, openSpot }) {
  const styles = useStyles();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState(spots[0]?.id);
  const strip = useRef(null);

  // nearest first when we know where you are
  const ordered = [...spots].sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapCard fill topOffset={insets.top + 190} spots={spots} user={user} selectedId={selectedId} onSelect={setSelectedId} />

      {/* title, over the map */}
      <View style={[styles.titleWrap, { top: insets.top + 76 }]} pointerEvents="none">
        <View style={styles.titleCard}>
          <Text style={styles.eyebrow}>YOUR WORLD, COLLECTED</Text>
          <Text style={styles.title}>
            Go there. <Text style={styles.titleLight}>Prove it.</Text>
          </Text>
        </View>
      </View>

      {/* spot cards, over the map */}
      <View style={[styles.stripWrap, { bottom: insets.bottom + 108 }]} pointerEvents="box-none">
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} snapToInterval={SNAP} decelerationRate="fast">
          {ordered.map((s) => {
            const near = s.dist != null && s.dist <= NEAR_METERS;
            const got = collected[s.id] != null;
            const on = s.id === selectedId;
            const away = formatDistance(s.dist);
            return (
              <Pressable key={s.id} onPress={() => setSelectedId(s.id)} style={[styles.card, on && styles.cardOn]}>
                <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} iconSize={20} labelSize={6} style={styles.thumb} />
                <View style={styles.cardText}>
                  <Text style={styles.cardName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>{got ? 'Collected' : away ? `${s.type} · ${away}` : s.type}</Text>
                  <View style={[styles.pill, (near || got) && styles.pillNear]}>
                    <Text style={[styles.pillText, (near || got) && { color: '#0B0B0F' }]}>{got ? 'In your passport' : near ? 'Near · capture' : s.dist == null ? '—' : 'Far'}</Text>
                  </View>
                </View>
                <Pressable style={styles.go} onPress={() => openSpot(s)} hitSlop={8}>
                  <Ionicons name="arrow-forward" size={16} color={C.green} />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const SNAP = 292;

const useStyles = makeStyles((C) => ({
  titleWrap: { position: 'absolute', left: 16, right: 16 },
  titleCard: { alignSelf: 'flex-start', backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  eyebrow: { fontFamily: F.semi, fontSize: 10, letterSpacing: 1.6, color: C.info },
  title: { fontFamily: F.bold, fontSize: 28, lineHeight: 33, letterSpacing: -1, color: C.ink, marginTop: 2 },
  titleLight: { fontFamily: F.reg },

  stripWrap: { position: 'absolute', left: 0, right: 0 },
  strip: { paddingHorizontal: 16, gap: 12 },
  card: { width: 280, flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 26, padding: 10, borderWidth: 2, borderColor: 'transparent', elevation: 4, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cardOn: { borderColor: C.green },
  thumb: { width: 54, height: 66 },
  cardText: { flex: 1, paddingHorizontal: 12 },
  cardName: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  cardMeta: { fontFamily: F.reg, fontSize: 11, color: C.muted, marginTop: 2 },
  pill: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 10, height: 22, borderRadius: 11, backgroundColor: C.soft, justifyContent: 'center' },
  pillNear: { backgroundColor: C.green },
  pillText: { fontFamily: F.semi, fontSize: 10, color: C.muted },
  go: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center' },
}));
