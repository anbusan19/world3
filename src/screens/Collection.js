import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stamp } from '../Stamp';
import { eventOf, getEvents, shortName, spots } from '../spots';
import { eventLine } from '../eventLine';
import { explorerUrl, fetchExplorer } from '../world';
import { F, STAMP_THEMES, makeStyles, useColors } from '../theme';

// Two views of the same place: "Mine" (my stamps) and "Explorer" (search every place, and see the 10 most recent
// stamps anyone collected; the full list opens on the website).
export function Collection({ collected, openSpot, openStamp }) {
  const styles = useStyles();
  const C = useColors();
  const [view, setView] = useState('mine');
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const filters = ['All', 'Landmarks', 'Events', 'Collected', 'To find'];
  const needle = q.trim().toLowerCase();
  const matches = (s) => !needle || `${s.name} ${s.city} ${s.type} ${s.label}`.toLowerCase().includes(needle);
  const shown = spots.filter((s) => matches(s) && (filter === 'All' || (filter === 'Landmarks' ? s.type === 'LANDMARK' : filter === 'Events' ? s.type === 'EVENT' : filter === 'Collected' ? collected[s.id] != null : collected[s.id] == null)));
  const have = spots.filter((s) => collected[s.id] != null).length;

  return (
    <>
      <Text style={styles.title}>{view === 'mine' ? 'Stamps' : 'Explorer'}</Text>
      <View style={styles.seg}>
        {[['mine', 'My stamps'], ['explorer', 'Explorer']].map(([k, label]) => (
          <Pressable key={k} onPress={() => setView(k)} style={[styles.segBtn, view === k && { backgroundColor: C.solid }]}>
            <Text style={[styles.segText, view === k && { color: C.onSolid, fontFamily: F.semi }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search stamps and places" placeholderTextColor={C.muted} style={styles.input} autoCorrect={false} returnKeyType="search" />
        {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable> : null}
      </View>

      {view === 'mine' ? (
        <>
          <Text style={styles.sub}>{have} of {spots.length} collected. Tap a stamp to open it.</Text>
          <Chips items={filters} value={filter} onChange={setFilter} />
          {shown.length === 0 ? <Text style={styles.empty}>No stamps match.</Text> : null}
          {groupByEvent(shown).map((g) => (
            <View key={g.id}>
              <View style={styles.evHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evName}>{g.ev?.name ?? 'Stamps'}</Text>
                  <Text style={styles.evSub}>{eventLine(g.ev)} · {g.items.filter((x) => collected[x.id] != null).length} of {g.items.length} collected</Text>
                </View>
                {g.ev?.status === 'ended' ? <View style={styles.memory}><Text style={styles.memoryText}>MEMORY</Text></View> : g.ev?.status === 'upcoming' ? <View style={styles.memory}><Text style={styles.memoryText}>SOON</Text></View> : null}
              </View>
              <View style={styles.grid}>
                {g.items.map((s) => {
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
            </View>
          ))}
        </>
      ) : (
        <ExplorerView q={q} places={shown} openSpot={openSpot} />
      )}
    </>
  );
}

function Chips({ items, value, onChange }) {
  const styles = useStyles();
  return (
    <View style={styles.chips}>
      {items.map((f) => (
        <Pressable key={f} onPress={() => onChange(f)} style={[styles.chip, value === f && styles.chipActive]}>
          <Text style={[styles.chipText, value === f && styles.chipTextActive]}>{f}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// stamps grouped by the event they belong to, the event that is live first, ended ones (memories) last
function groupByEvent(list) {
  const rank = (e) => (e?.status === 'live' ? 0 : e?.status === 'upcoming' ? 1 : 2);
  const map = new Map();
  for (const s of list) { const id = s.eventId ?? 'ethmumbai'; if (!map.has(id)) map.set(id, { id, ev: eventOf(s), items: [] }); map.get(id).items.push(s); }
  // live first, and among those the one closing soonest (the limited-time ones) on top; ended memories last
  const end = (e) => (e?.endsAt ? Date.parse(e.endsAt) : Infinity);
  return [...map.values()].sort((a, b) => rank(a.ev) - rank(b.ev) || end(a.ev) - end(b.ev));
}

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

function ExplorerView({ q, places, openSpot }) {
  const styles = useStyles();
  const C = useColors();
  const [data, setData] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    const pull = () => fetchExplorer({ limit: 10, q }).then((r) => live && setData(r ? { status: 'ok', ...r } : { status: 'error' }));
    const t = setTimeout(pull, q ? 300 : 0);
    const i = setInterval(pull, 20000);
    return () => { live = false; clearTimeout(t); clearInterval(i); };
  }, [q]);

  const seeAll = () => {
    const u = explorerUrl();
    if (u) Linking.openURL(u).catch(() => {});
    else Alert.alert('Needs a public address', 'The full explorer is a web page. Set a public https address for the spot server (Profile, Settings, Developer) to open it from your phone.');
  };

  return (
    <>
      <View style={styles.head}>
        <Text style={styles.h2}>Recent stamps</Text>
        <Text style={styles.sub2}>latest 10</Text>
      </View>
      <View style={styles.card}>
        {data.status === 'loading' ? <ActivityIndicator color={C.muted} style={{ margin: 18 }} /> : null}
        {data.status === 'error' ? <Text style={styles.empty}>Could not reach the server.</Text> : null}
        {data.status === 'ok' && data.items.length === 0 ? <Text style={styles.empty}>{q ? 'No stamps match.' : 'No stamps collected yet.'}</Text> : null}
        {data.status === 'ok' && data.items.map((e, i) => {
          const t = STAMP_THEMES[e.theme] ?? STAMP_THEMES.coral;
          return (
            <View key={`${e.spotId}-${e.at}-${i}`} style={[styles.item, i > 0 && styles.itemLine]}>
              <View style={[styles.avatar, { backgroundColor: t.frame }]}><Text style={[styles.avatarText, { color: t.accent }]}>{e.spotId}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.who} numberOfLines={1}>{e.who}</Text>
                <Text style={styles.what} numberOfLines={1}>collected {e.spot}</Text>
              </View>
              <Text style={styles.when}>{ago(e.at)}</Text>
            </View>
          );
        })}
        <Pressable style={styles.all} onPress={seeAll}>
          <Text style={styles.allText}>See all on the website</Text>
          <View style={styles.allArrow}><Ionicons name="arrow-forward" size={14} color={C.green} /></View>
        </Pressable>
      </View>

      <View style={styles.head}>
        <Text style={styles.h2}>Places</Text>
        <Text style={styles.sub2}>{places.length}</Text>
      </View>
      {places.map((s) => (
        <Pressable key={s.id} style={styles.place} onPress={() => openSpot(s)}>
          <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} iconSize={20} labelSize={6} style={{ width: 46, height: 56 }} />
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={styles.who} numberOfLines={1}>{s.name}</Text>
            <Text style={styles.what}>{s.type} · {s.city}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>
      ))}
      {places.length === 0 ? <Text style={styles.empty}>No places match.</Text> : null}
    </>
  );
}

const useStyles = makeStyles((C) => ({
  title: { fontFamily: F.bold, fontSize: 30, color: C.ink, letterSpacing: -0.8 },
  sub: { fontFamily: F.reg, fontSize: 13, color: C.muted, marginTop: 14 },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 22, padding: 4, marginTop: 14 },
  segBtn: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: F.reg, fontSize: 13, color: C.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 24, paddingHorizontal: 16, height: 48, marginTop: 12 },
  input: { flex: 1, fontFamily: F.reg, fontSize: 14, color: C.ink, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 18 },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: C.card, justifyContent: 'center' },
  chipActive: { backgroundColor: C.solid },
  chipText: { fontFamily: F.semi, fontSize: 12, color: C.ink },
  chipTextActive: { color: C.onSolid },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  evHead: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 14 },
  evName: { fontFamily: F.bold, fontSize: 19, color: C.ink, letterSpacing: -0.4 },
  evSub: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
  memory: { backgroundColor: C.solid, borderRadius: 12, paddingHorizontal: 10, height: 24, justifyContent: 'center' },
  memoryText: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1, color: C.onSolid },
  cell: { width: '47%' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  name: { flex: 1, fontFamily: F.semi, fontSize: 13, color: C.ink, paddingRight: 6 },
  count: { fontFamily: F.reg, fontSize: 13, color: C.muted },
  empty: { fontFamily: F.reg, fontSize: 13, color: C.muted, textAlign: 'center', padding: 18 },

  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  h2: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: -0.4 },
  sub2: { fontFamily: F.reg, fontSize: 12, color: C.muted },
  card: { backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 16, paddingTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  itemLine: { borderTopWidth: 1, borderTopColor: C.line },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontFamily: F.bold, fontSize: 11 },
  who: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  what: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
  when: { fontFamily: F.semi, fontSize: 11, color: C.muted },
  all: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 14 },
  allText: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  allArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 22, padding: 10, marginBottom: 10 },
}));
