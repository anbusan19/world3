import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import * as SystemUI from 'expo-system-ui';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { F, ThemeProvider, makeStyles, useColors, useTheme } from './src/theme';
import { loadFeedBase, refreshSpots, spots } from './src/spots';
import { distanceMeters } from './src/geo';
import { useLocation } from './src/useLocation';
import { fetchMyCaptures, loadSession, signOut } from './src/world';
import { Onboarding } from './src/Onboarding';
import { SignIn } from './src/screens/SignIn';
import { Home } from './src/screens/Home';
import { Collection } from './src/screens/Collection';
import { GlobeScreen } from './src/screens/GlobeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SpotDetail } from './src/screens/SpotDetail';
import { Capture } from './src/screens/Capture';
import { StampDetail } from './src/screens/StampDetail';

SplashScreen.preventAutoHideAsync().catch(() => {});

const TABS = [
  { key: 'EXPLORE', icon: 'compass' },
  { key: 'COLLECTION', icon: 'albums' },
  { key: 'GLOBE', icon: 'earth' },
  { key: 'PASSPORT', icon: 'person' },
];

// Frontend only. Nothing here is saved except the colour theme: onboarding, sign-in, collected stamps, the profile and
// the settings switches all reset when the app restarts.
export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const styles = useStyles();
  const C = useColors();
  const { isDark } = useTheme();
  const barStyle = isDark ? 'light' : 'dark';
  const [phase, setPhase] = useState('onboarding'); // 'onboarding' | 'signin' | 'app'
  const [tab, setTab] = useState('EXPLORE');
  const [stack, setStack] = useState([]); // overlay screens on top of the tabs: { name, spotId }
  const [collected, setCollected] = useState({}); // spotId -> time captured
  const [scrollLock, setScrollLock] = useState(false);
  const [profile, setProfile] = useState({ name: 'Explorer', avatar: 'sky' });
  // the name and avatar colour are remembered on the phone
  useEffect(() => {
    SecureStore.getItemAsync('world3.profile').then((v) => { if (v) setProfile((p) => ({ ...p, ...JSON.parse(v) })); }).catch(() => {});
  }, []);
  const saveProfile = useCallback((next) => {
    setProfile((p) => {
      const n = typeof next === 'function' ? next(p) : next;
      SecureStore.setItemAsync('world3.profile', JSON.stringify({ name: n.name, avatar: n.avatar, image: n.image ?? null })).catch(() => {});
      return n;
    });
  }, []);
  const [settings, setSettings] = useState({ nearby: true, captures: true, haptics: true });
  const updateSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const backOverride = useRef(null); // a screen can claim Android back (e.g. the capture flow's own steps)
  const user = useLocation();
  const [, setFeedTick] = useState(0);
  // pull published spots from the dashboard server on start and every 20 s (silently keeps the bundled spots if unreachable)
  useEffect(() => {
    let live = true;
    const pull = () => refreshSpots().then((changed) => live && changed && setFeedTick((n) => n + 1));
    loadFeedBase().then(pull);
    const t = setInterval(pull, 20000);
    return () => { live = false; clearInterval(t); };
  }, []);

  // a saved World ID session skips onboarding and sign-in
  useEffect(() => {
    let live = true;
    loadFeedBase().then(() => loadSession()).then((u) => { if (live && u) setPhase('app'); });
    return () => { live = false; };
  }, []);

  // stamps are kept on the server; load them whenever the person is in the app (after a restart, or on a new phone)
  useEffect(() => {
    if (phase !== 'app') return;
    let live = true;
    fetchMyCaptures().then((list) => { if (live && list.length) setCollected((c) => ({ ...Object.fromEntries(list.map((x) => [x.spotId, Date.parse(x.at) || Date.now()])), ...c })); });
    return () => { live = false; };
  }, [phase]);

  const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, GeistMono_500Medium });
  const onLayout = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const spotsWithDist = spots.map((s) => ({ ...s, dist: user.coords ? distanceMeters(user.coords, s.coord) : null }));
  const byId = (id) => spotsWithDist.find((s) => s.id === id);

  const push = (name, spot) => setStack((s) => [...s, { name, spotId: spot.id }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const registerBack = useCallback((fn) => { backOverride.current = fn; }, []);

  // keep the Android window behind the app the same colour as the page, so there is no white flash when switching theme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
  }, [C.bg]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backOverride.current?.()) return true;
      if (stack.length) { pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  if (!fontsLoaded) return null;

  if (phase === 'onboarding') {
    return (
      <SafeAreaProvider>
        <StatusBar style={barStyle} />
        <View style={{ flex: 1 }} onLayout={onLayout}>
          <Onboarding onDone={() => setPhase('signin')} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (phase === 'signin') {
    return (
      <SafeAreaProvider>
        <StatusBar style={barStyle} />
        <View style={{ flex: 1 }} onLayout={onLayout}>
          <SignIn onDone={() => setPhase('app')} />
        </View>
      </SafeAreaProvider>
    );
  }

  // overlay screen (spot, capture, stamp), drawn over the tabs
  const top = stack[stack.length - 1];
  if (top) {
    const spot = byId(top.spotId);
    return (
      <SafeAreaProvider>
        <StatusBar style={barStyle} />
        <View style={{ flex: 1 }} onLayout={onLayout}>
          {top.name === 'spot' && (
            <SpotDetail
              key={spot.id}
              spot={spot}
              collectedAt={collected[spot.id]}
              onBack={pop}
              onCapture={() => push('capture', spot)}
              onOpenStamp={() => push('stamp', spot)}
            />
          )}
          {top.name === 'capture' && (
            <Capture
              spot={spot}
              user={user}
              onClose={pop}
              onSuccess={(s) => setCollected((c) => ({ ...c, [s.id]: Date.now() }))}
              onViewPassport={() => { setStack([]); setTab('PASSPORT'); }}
              registerBack={registerBack}
            />
          )}
          {top.name === 'stamp' && <StampDetail spot={spot} collectedAt={collected[spot.id]} onBack={pop} />}
        </View>
      </SafeAreaProvider>
    );
  }

  // Explore and Globe are full-screen maps with the text laid over them; the other tabs scroll as normal pages
  const full = tab === 'EXPLORE' || tab === 'GLOBE';

  return (
    <SafeAreaProvider>
      {full && (
        <View style={StyleSheet.absoluteFill}>
          {tab === 'EXPLORE' && <Home spots={spotsWithDist} user={user} collected={collected} openSpot={(s) => push('spot', s)} />}
          {tab === 'GLOBE' && <GlobeScreen />}
        </View>
      )}
      <SafeAreaView style={[styles.safe, full && { backgroundColor: 'transparent' }]} onLayout={onLayout} pointerEvents="box-none">
        <StatusBar style={barStyle} />
        <View style={styles.shell} pointerEvents="box-none">
          <View style={[styles.header, full && styles.headerFloat]} pointerEvents="box-none">
            <View style={[styles.brandRow, full && styles.chip]}>
              <Image source={require('./assets/logo.png')} style={styles.logo} />
              <View>
                <Text style={styles.hello}>Hello,</Text>
                <Text style={styles.name} numberOfLines={1}>{profile.name.trim() || 'Explorer'}</Text>
              </View>
            </View>
            <View style={styles.network}>
              <View style={styles.greenDot} />
              <Text style={styles.networkText}>Sepolia</Text>
            </View>
          </View>

          {!full && (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!scrollLock}
          >
            {tab === 'COLLECTION' && (
              <Collection collected={collected} openSpot={(s) => push('spot', s)} openStamp={(s) => push('stamp', s)} />
            )}
            {tab === 'PASSPORT' && (
              <ProfileScreen
                collected={collected}
                openStamp={(s) => push('stamp', s)}
                profile={profile}
                setProfile={saveProfile}
                settings={settings}
                updateSetting={updateSetting}
                onSignOut={() => { signOut(); setPhase('signin'); setTab('EXPLORE'); }}
              />
            )}
          </ScrollView>
          )}
          {full && <View style={{ flex: 1 }} pointerEvents="none" />}

          <View style={styles.tabBar}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    if (settings.haptics && !active) Haptics.selectionAsync().catch(() => {});
                    setTab(t.key);
                  }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Ionicons name={active ? t.icon : `${t.icon}-outline`} size={22} color={active ? C.onSolid : C.ink} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const useStyles = makeStyles((C) => ({
  safe: { flex: 1, backgroundColor: C.bg },
  shell: { flex: 1, maxWidth: 600, width: '100%', alignSelf: 'center' },

  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerFloat: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  chip: { backgroundColor: C.card, borderRadius: 26, padding: 4, paddingRight: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  logo: { width: 46, height: 46, borderRadius: 15 },
  hello: { fontFamily: F.med, fontSize: 12, color: C.muted },
  name: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  network: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.panel, paddingHorizontal: 14, height: 40, borderRadius: 20 },
  networkText: { fontFamily: F.bold, fontSize: 12, color: '#fff' },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },

  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 120 },

  tabBar: { position: 'absolute', bottom: 18, alignSelf: 'center', flexDirection: 'row', gap: 8, padding: 8, borderRadius: 40, backgroundColor: C.card, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  tab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft },
  tabActive: { backgroundColor: C.solid },
}));
