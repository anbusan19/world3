import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stamp } from '../Stamp';
import { PrimaryButton } from '../ui';
import { getFeedBase, refreshSpots, setFeedBase, shortName, spots } from '../spots';
import { DARK, F, LIGHT, STAMP_THEMES, makeStyles, useColors, useTheme } from '../theme';

// Profile tab = a header (avatar, name, passport name, stats) plus two sections: Passport and Settings.
// FRONTEND ONLY: the name, avatar and switches live in memory (app state) and reset on restart. Only the colour theme is
// remembered on the device. The passport name, email and wallet shown here are previews, nothing is connected yet.

const AVATARS = ['sky', 'coral', 'sun', 'leaf', 'ocean'];
const slug = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'explorer';

const ACHIEVEMENTS = [
  { key: 'first', icon: 'ribbon', title: 'First stamp', body: 'Capture any spot', test: ({ n }) => n >= 1 },
  { key: 'landmarks', icon: 'business', title: 'Landmark hunter', body: 'Collect every landmark', test: ({ landmarks }) => landmarks >= spots.filter((s) => s.type === 'LANDMARK').length },
  { key: 'event', icon: 'ticket', title: 'Event goer', body: 'Capture an event spot', test: ({ events }) => events >= 1 },
  { key: 'all', icon: 'trophy', title: 'Full passport', body: 'Collect every spot', test: ({ n }) => n >= spots.length },
];

function statsOf(collected) {
  const mine = spots.filter((s) => collected[s.id] != null);
  return {
    mine,
    n: mine.length,
    landmarks: mine.filter((s) => s.type === 'LANDMARK').length,
    events: mine.filter((s) => s.type === 'EVENT').length,
  };
}

export function ProfileScreen({ collected, openStamp, profile, setProfile, settings, updateSetting, onSignOut }) {
  const styles = useStyles();
  const [section, setSection] = useState('passport');
  const stats = statsOf(collected);

  return (
    <>
      <Header profile={profile} stats={stats} />

      <View style={styles.segment}>
        {[
          { key: 'passport', label: 'Passport', icon: 'albums-outline' },
          { key: 'settings', label: 'Settings', icon: 'settings-outline' },
        ].map((o) => (
          <Pressable key={o.key} onPress={() => setSection(o.key)} style={[styles.seg, section === o.key && styles.segOn]}>
            <SegLabel icon={o.icon} label={o.label} on={section === o.key} />
          </Pressable>
        ))}
      </View>

      {section === 'passport' ? (
        <PassportSection stats={stats} openStamp={openStamp} settings={settings} goSettings={() => setSection('settings')} />
      ) : (
        <SettingsSection profile={profile} setProfile={setProfile} settings={settings} updateSetting={updateSetting} onSignOut={onSignOut} />
      )}
    </>
  );
}

function SegLabel({ icon, label, on }) {
  const styles = useStyles();
  const C = useColors();
  return (
    <View style={styles.segInner}>
      <Ionicons name={icon} size={16} color={on ? C.onSolid : C.muted} />
      <Text style={[styles.segText, on && { color: C.onSolid }]}>{label}</Text>
    </View>
  );
}

/* --------------------------------- header ---------------------------------- */

export function Avatar({ name, theme, size = 84 }) {
  const styles = useStyles();
  const t = STAMP_THEMES[theme] ?? STAMP_THEMES.sky;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.frame }]}>
      <Text style={[styles.avatarText, { color: t.accent, fontSize: size * 0.42 }]}>{(name || 'E').trim().charAt(0).toUpperCase() || 'E'}</Text>
    </View>
  );
}

function Header({ profile, stats }) {
  const styles = useStyles();
  return (
    <>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Avatar name={profile.name} theme={profile.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{profile.name || 'Explorer'}</Text>
            <Text style={styles.ens} numberOfLines={1}>{slug(profile.name)}.world3.eth</Text>
            <View style={styles.badges}>
              <View style={[styles.pill, { backgroundColor: '#A6D16C' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#0B0B0F" />
                <Text style={[styles.pillText, { color: '#0B0B0F' }]}>Verified human</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.preview}>Passport name is a preview. Nothing is registered yet.</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={stats.n} label="Stamps" />
        <Stat value={stats.landmarks} label="Landmarks" />
        <Stat value={stats.events} label="Events" />
      </View>
    </>
  );
}

function Stat({ value, label }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* -------------------------------- passport --------------------------------- */

function PassportSection({ stats, openStamp, settings, goSettings }) {
  const styles = useStyles();
  const C = useColors();
  return (
    <>
      <Text style={styles.section}>Stamps</Text>
      {stats.mine.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="albums-outline" size={26} color={C.muted} />
          <Text style={styles.emptyText}>No stamps yet. Capture a spot and it appears here.</Text>
        </View>
      ) : (
        <View style={styles.strip}>
          {stats.mine.map((s) => (
            <Pressable key={s.id} style={styles.mini} onPress={() => openStamp(s)}>
              <Stamp theme={s.theme} art={s.art} icon={s.icon} label={shortName(s)} tag={s.id} iconSize={34} labelSize={11} />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.section}>Achievements</Text>
      <View style={styles.achGrid}>
        {ACHIEVEMENTS.map((a) => {
          const got = a.test(stats);
          return (
            <View key={a.key} style={[styles.ach, !got && { opacity: 0.6 }]}>
              <View style={[styles.achIcon, { backgroundColor: got ? C.green : C.soft }]}>
                <Ionicons name={got ? a.icon : 'lock-closed'} size={20} color={got ? '#0B0B0F' : C.muted} />
              </View>
              <Text style={styles.achTitle}>{a.title}</Text>
              <Text style={styles.achBody}>{a.body}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.section}>Share</Text>
      <PrimaryButton label="Share passport" icon="share-outline" disabled={!settings.publicPassport} onPress={() => {}} />
      {!settings.publicPassport && (
        <Pressable onPress={goSettings} hitSlop={8}>
          <Text style={styles.hint}>Your passport is private. Turn on “Public passport” in Settings to share it.</Text>
        </Pressable>
      )}
    </>
  );
}

/* -------------------------------- settings --------------------------------- */

function Group({ title, children, note }) {
  const styles = useStyles();
  return (
    <View style={styles.groupWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
      {note ? <Text style={styles.groupNote}>{note}</Text> : null}
    </View>
  );
}

function SpotServer({ onSynced }) {
  const C = useColors();
  const styles = useStyles();
  const [url, setUrl] = useState(getFeedBase());
  const [msg, setMsg] = useState('');
  const sync = async () => {
    setMsg('Checking…');
    const base = await setFeedBase(url);
    setUrl(base);
    const n = await refreshSpots(true);
    setMsg(n < 0 ? 'Could not reach that server.' : `Connected · ${n} spot${n === 1 ? '' : 's'}`);
    if (n >= 0) onSynced?.();
  };
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>Spot server</Text>
        <Text style={styles.rowSub}>Where spots and 3D models come from. Paste the https link from the dashboard share step.</Text>
        <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://…trycloudflare.com" placeholderTextColor={C.muted} style={[styles.input, { marginTop: 8 }]} />
        <Pressable onPress={sync} hitSlop={6} style={{ marginTop: 8 }}>
          <Text style={[styles.rowTitle, { color: C.info }]}>Save and test{msg ? `  ·  ${msg}` : ''}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ icon, tint, title, sub, right, onPress, last, danger }) {
  const styles = useStyles();
  const C = useColors();
  const color = danger ? C.orange : C.ink;
  const body = (
    <View style={[styles.row, !last && styles.rowLine]}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: (tint ?? C.info) + '22' }]}>
          <Ionicons name={icon} size={18} color={tint ?? C.info} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} android_ripple={{ color: C.line }}>{body}</Pressable> : body;
}

function Toggle({ value, onChange }) {
  const C = useColors();
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: C.green, false: C.line }} thumbColor="#FFFFFF" />;
}

// a small picture of how each theme looks
function ThemeOption({ mode, label, icon, selected, onPress }) {
  const styles = useStyles();
  const C = useColors();
  const half = (P, flex = 1) => (
    <View style={{ flex, backgroundColor: P.bg, padding: 6, justifyContent: 'center', gap: 4 }}>
      <View style={{ height: 10, borderRadius: 4, backgroundColor: P.card }} />
      <View style={{ height: 7, width: '60%', borderRadius: 4, backgroundColor: P.solid }} />
    </View>
  );
  return (
    <Pressable onPress={onPress} style={[styles.themeOpt, selected && { borderColor: C.green }]}>
      <View style={styles.themePreview}>
        {mode === 'system' ? (
          <>
            {half(LIGHT)}
            {half(DARK)}
          </>
        ) : (
          half(mode === 'dark' ? DARK : LIGHT)
        )}
      </View>
      <View style={styles.themeLabelRow}>
        <Ionicons name={icon} size={14} color={selected ? C.ink : C.muted} />
        <Text style={[styles.themeLabel, selected && { color: C.ink, fontFamily: F.bold }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function SettingsSection({ profile, setProfile, settings, updateSetting, onSignOut }) {
  const styles = useStyles();
  const C = useColors();
  const { mode, setMode, isDark } = useTheme();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <>
      <Group title="Appearance" note={mode === 'system' ? `Following your phone: currently ${isDark ? 'dark' : 'light'}.` : undefined}>
        <View style={styles.themeRow}>
          <ThemeOption mode="system" label="System" icon="phone-portrait-outline" selected={mode === 'system'} onPress={() => setMode('system')} />
          <ThemeOption mode="light" label="Light" icon="sunny-outline" selected={mode === 'light'} onPress={() => setMode('light')} />
          <ThemeOption mode="dark" label="Dark" icon="moon-outline" selected={mode === 'dark'} onPress={() => setMode('dark')} />
        </View>
      </Group>

      <Group title="Profile">
        <View style={[styles.row, styles.rowLine]}>
          <View style={[styles.rowIcon, { backgroundColor: C.info + '22' }]}>
            <Ionicons name="person-outline" size={18} color={C.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowSub}>Display name</Text>
            <TextInput
              value={profile.name}
              onChangeText={(t) => setProfile((p) => ({ ...p, name: t }))}
              placeholder="Explorer"
              placeholderTextColor={C.muted}
              maxLength={18}
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Avatar colour</Text>
            <View style={styles.avatars}>
              {AVATARS.map((a) => (
                <Pressable key={a} onPress={() => setProfile((p) => ({ ...p, avatar: a }))} hitSlop={4}>
                  <View style={[styles.swatchRing, profile.avatar === a && { borderColor: C.ink }]}>
                    <View style={[styles.swatch, { backgroundColor: STAMP_THEMES[a].frame }]} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Group>

      <Group title="Notifications">
        <Row icon="navigate-outline" tint={C.green} title="Nearby spots" sub="Tell me when I’m close to a spot" right={<Toggle value={settings.nearby} onChange={(v) => updateSetting('nearby', v)} />} />
        <Row icon="notifications-outline" tint={C.orange} title="Capture updates" sub="Stamp minted or refused" right={<Toggle value={settings.captures} onChange={(v) => updateSetting('captures', v)} />} />
        <Row icon="phone-portrait-outline" tint={C.info} title="Haptics" sub="A small tap when you switch tabs" right={<Toggle value={settings.haptics} onChange={(v) => updateSetting('haptics', v)} />} last />
      </Group>

      <Group title="Privacy" note="Stamps record the spot and time, never your coordinates. Location evidence is discarded after verification.">
        <Row icon="eye-outline" tint={C.info} title="Public passport" sub={settings.publicPassport ? 'Anyone with your passport name can see your stamps' : 'Private. Only you can see your stamps'} right={<Toggle value={settings.publicPassport} onChange={(v) => updateSetting('publicPassport', v)} />} last />
      </Group>

      <Group title="Account">
        <Row icon="mail-outline" title="Email" sub="you@example.com" />
        <Row icon="wallet-outline" title="Wallet" sub="Invisible wallet · 0x7a3…f1c" />
        <Row icon="log-out-outline" tint={C.orange} title="Sign out" danger onPress={onSignOut} last />
      </Group>

      <Group title="Developer">
        <SpotServer />
      </Group>

      <Group title="About">
        <Row icon="information-circle-outline" title="Version" sub={`World3 ${version}`} />
        <Row icon="git-network-outline" title="Network" sub="Ethereum Sepolia (testnet)" />
        <Row icon="document-text-outline" title="Terms of use" right={<Ionicons name="chevron-forward" size={18} color={C.muted} />} onPress={() => {}} />
        <Row icon="lock-closed-outline" title="Privacy policy" right={<Ionicons name="chevron-forward" size={18} color={C.muted} />} onPress={() => {}} last />
      </Group>

      <Text style={styles.footer}>Prototype for ETHGlobal Mumbai. Testnet only, not audited.</Text>
    </>
  );
}

const useStyles = makeStyles((C) => ({
  title: { fontFamily: F.black, fontSize: 30, color: C.ink, letterSpacing: -0.8, marginBottom: 16 },

  card: { backgroundColor: C.blue, borderRadius: 28, padding: 20 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFFFFF' },
  avatarText: { fontFamily: F.black },
  name: { fontFamily: F.black, fontSize: 22, color: '#FFFFFF', letterSpacing: -0.4 },
  ens: { fontFamily: 'monospace', fontSize: 13, color: '#CFE5F5', marginTop: 4 },
  badges: { flexDirection: 'row', marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 13 },
  pillText: { fontFamily: F.bold, fontSize: 11 },
  preview: { fontFamily: F.med, fontSize: 11, color: '#CFE5F5', marginTop: 14 },

  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  statNum: { fontFamily: F.black, fontSize: 24, color: C.ink },
  statLabel: { fontFamily: F.med, fontSize: 11, color: C.muted, marginTop: 2 },

  segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 26, padding: 4, marginTop: 18 },
  seg: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.solid },
  segInner: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  segText: { fontFamily: F.bold, fontSize: 13, color: C.muted },

  section: { fontFamily: F.black, fontSize: 20, letterSpacing: -0.4, color: C.ink, marginTop: 26, marginBottom: 12 },
  empty: { backgroundColor: C.card, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: F.med, fontSize: 13, color: C.muted, textAlign: 'center' },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  mini: { width: '30%' },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ach: { width: '47.5%', flexGrow: 1, backgroundColor: C.card, borderRadius: 20, padding: 14 },
  achIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  achTitle: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  achBody: { fontFamily: F.med, fontSize: 11, lineHeight: 15, color: C.muted, marginTop: 3 },
  hint: { fontFamily: F.med, fontSize: 12, lineHeight: 17, color: C.muted, textAlign: 'center', marginTop: 10 },

  groupWrap: { marginTop: 22 },
  groupTitle: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.8, color: C.muted, marginBottom: 8, marginLeft: 6, textTransform: 'uppercase' },
  group: { backgroundColor: C.card, borderRadius: 22, overflow: 'hidden' },
  groupNote: { fontFamily: F.med, fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 8, marginHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 58 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  rowSub: { fontFamily: F.med, fontSize: 12, lineHeight: 16, color: C.muted, marginTop: 2 },
  input: { fontFamily: F.bold, fontSize: 15, color: C.ink, paddingVertical: 2, paddingHorizontal: 0 },

  themeRow: { flexDirection: 'row', gap: 10, padding: 14 },
  themeOpt: { flex: 1, borderRadius: 16, borderWidth: 2, borderColor: C.line, padding: 8, alignItems: 'center' },
  themePreview: { width: '100%', height: 54, borderRadius: 10, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: C.line },
  themeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  themeLabel: { fontFamily: F.med, fontSize: 12, color: C.muted },

  avatars: { flexDirection: 'row', gap: 10, marginTop: 10 },
  swatchRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14 },

  footer: { fontFamily: F.med, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 22 },
}));
