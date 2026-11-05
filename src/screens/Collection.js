import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stamp } from '../Stamp';
import { shortName, spots } from '../spots';
import { F, makeStyles } from '../theme';

export function Collection({ collected, openSpot, openStamp }) {
  const styles = useStyles();
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Landmarks', 'Events'];
  const shown = spots.filter((s) => filter === 'All' || (filter === 'Landmarks' ? s.type === 'LANDMARK' : s.type === 'EVENT'));
  const have = Object.keys(collected).length;

  return (
    <>
      <Text style={styles.title}>My Stamps</Text>
      <Text style={styles.sub}>{have} of {spots.length} collected. Tap a stamp to open it.</Text>
      <View style={styles.chips}>
        {filters.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {shown.map((s) => {
          const got = collected[s.id] != null;
          return (
            <Pressable key={s.id} style={styles.cell} onPress={() => (got ? openStamp(s) : openSpot(s))}>
              <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} tag={s.id} locked={!got} iconSize={46} labelSize={14} holes={10} />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.count}>{got ? '1/1' : '0/1'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const useStyles = makeStyles((C) => ({
  title: { fontFamily: F.black, fontSize: 30, color: C.ink, letterSpacing: -0.8 },
  sub: { fontFamily: F.med, fontSize: 13, color: C.muted, marginTop: 6 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 20 },
  chip: { paddingHorizontal: 16, height: 34, borderRadius: 17, backgroundColor: C.card, justifyContent: 'center' },
  chipActive: { backgroundColor: C.solid },
  chipText: { fontFamily: F.bold, fontSize: 12, color: C.ink },
  chipTextActive: { color: C.onSolid },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { width: '47%' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  name: { flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink, paddingRight: 6 },
  count: { fontFamily: F.med, fontSize: 13, color: C.muted },
}));
