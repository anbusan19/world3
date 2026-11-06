import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from '../Stamp';
import { eventLine } from '../eventLine';
import { getEvents, shortName, spots } from '../spots';
import { F, makeStyles, useColors } from '../theme';

// Every event in one place: when it runs, how far along you are, and its quests. Finished events stay here as memories.
export function Events({ collected, openSpot }) {
  const styles = useStyles();
  const C = useColors();
  const rank = (e) => (e.status === 'live' ? 0 : e.status === 'upcoming' ? 1 : 2);
  const end = (e) => (e.endsAt ? Date.parse(e.endsAt) : Infinity);
  const list = [...getEvents()].sort((a, b) => rank(a) - rank(b) || end(a) - end(b));
  const inEvent = (id) => spots.filter((s) => (s.eventId ?? 'ethmumbai') === id);

  return (
    <>
      <Text style={styles.title}>Events</Text>
      <Text style={styles.sub}>Limited-time events open and close on their own clock. What you collect stays with you as a memory.</Text>
      {list.length === 0 ? <Text style={styles.empty}>No events yet.</Text> : null}
      {list.map((ev) => {
        const items = inEvent(ev.id);
        const got = items.filter((s) => collected[s.id] != null).length;
        const quests = items.filter((s) => s.kind === 'quest');
        const plain = items.filter((s) => s.kind !== 'quest');
        const pct = plain.length ? Math.min(1, plain.filter((s) => collected[s.id] != null).length / plain.length) : 0;
        const live = ev.status === 'live';
        return (
          <View key={ev.id} style={[styles.card, !live && { opacity: ev.status === 'ended' ? 0.85 : 1 }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{ev.name}</Text>
                <Text style={styles.line}>{eventLine(ev)}</Text>
              </View>
              <View style={[styles.pill, live && { backgroundColor: C.green }]}>
                <Text style={[styles.pillText, live && { color: '#0B0B0F' }]}>{ev.status === 'live' ? 'LIVE' : ev.status === 'upcoming' ? 'SOON' : 'MEMORY'}</Text>
              </View>
            </View>
            {ev.blurb ? <Text style={styles.blurb}>{ev.blurb}</Text> : null}

            <View style={styles.barRow}>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` }]} /></View>
              <Text style={styles.barText}>{got} of {items.length}</Text>
            </View>

            <View style={styles.strip}>
              {plain.slice(0, 6).map((s) => (
                <Pressable key={s.id} onPress={() => openSpot(s)} style={[styles.mini, collected[s.id] == null && { opacity: 0.5 }]}>
                  <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} iconSize={18} labelSize={6} />
                </Pressable>
              ))}
              {plain.length > 6 ? <View style={styles.more}><Text style={styles.moreText}>+{plain.length - 6}</Text></View> : null}
            </View>

            {quests.map((q) => {
              const have = q.requires ? q.requires.from.filter((id) => collected[id] != null).length : 0;
              const need = q.requires?.min ?? 0;
              const done = collected[q.id] != null;
              const open = !done && have >= need && live;
              return (
                <Pressable key={q.id} style={[styles.quest, open && { borderColor: C.green }]} onPress={() => openSpot(q)}>
                  <View style={[styles.qIcon, { backgroundColor: done || open ? C.green : C.soft }]}>
                    <Ionicons name={done ? 'checkmark' : open ? 'trophy' : 'lock-closed'} size={18} color={done || open ? '#0B0B0F' : C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qName}>{q.name}</Text>
                    <Text style={styles.qSub}>{done ? 'Claimed' : `Collect ${need === q.requires?.from.length ? 'all' : `any ${need} of`} ${q.requires?.from.length ?? 0} stamps · ${Math.min(have, need)} of ${need}`}</Text>
                  </View>
                  <Text style={[styles.qCta, open && { color: C.green }]}>{done ? '' : open ? 'Claim' : ''}</Text>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

const useStyles = makeStyles((C) => ({
  title: { fontFamily: F.bold, fontSize: 30, color: C.ink, letterSpacing: -0.8 },
  sub: { fontFamily: F.reg, fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 6, marginBottom: 18 },
  empty: { fontFamily: F.reg, fontSize: 13, color: C.muted, textAlign: 'center', padding: 24 },
  card: { backgroundColor: C.card, borderRadius: 28, padding: 18, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: -0.4 },
  line: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
  pill: { backgroundColor: C.soft, borderRadius: 12, paddingHorizontal: 10, height: 24, justifyContent: 'center' },
  pillText: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1, color: C.muted },
  blurb: { fontFamily: F.reg, fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.soft, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.green },
  barText: { fontFamily: F.semi, fontSize: 12, color: C.ink },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  mini: { width: 46, height: 56 },
  more: { width: 46, height: 56, borderRadius: 8, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: F.bold, fontSize: 12, color: C.muted },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, borderRadius: 20, borderWidth: 2, borderColor: C.line },
  qIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  qName: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  qSub: { fontFamily: F.reg, fontSize: 11, color: C.muted, marginTop: 2 },
  qCta: { fontFamily: F.bold, fontSize: 12, color: C.muted },
}));
