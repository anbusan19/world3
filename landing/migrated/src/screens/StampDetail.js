import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stamp3D } from '../Stamp3D';
import { BackButton, Chip, InfoRow, PrimaryButton } from '../ui';
import { shareStamp } from '../world';
import { F, makeStyles } from '../theme';

const fmtDate = (ms) =>
  new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// A collected stamp. The token is a real non-transferable ERC-1155 on Sepolia, minted by the server's relayer right after the capture.
export function StampDetail({ spot, collectedAt, onBack, mintUrl = null, onRefresh }) {
  // the stamp is minted on chain a few seconds after the capture: keep asking until the transaction is known
  useEffect(() => {
    if (mintUrl || !onRefresh) return undefined;
    onRefresh();
    const t = setInterval(onRefresh, 6000);
    return () => clearInterval(t);
  }, [mintUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const styles = useStyles();
  const tokenId = `#${spot.id.padStart(4, '0')}`;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton onPress={onBack} />
        <Text style={styles.topTitle}>Stamp</Text>
        <View style={{ width: 46 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Stamp3D spot={spot} width={230} timed />
        </View>
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.sub}>Captured {fmtDate(collectedAt)}</Text>
        <View style={styles.chips}>
          <Chip icon="lock-closed" tone="ink" label="Non-transferable" />
          <Chip icon="shield-checkmark" label="Unique human" />
        </View>

        <View style={styles.card}>
          <Row k="Token" v={`ERC-1155 · ${tokenId}`} mono />
          <Row k="Network" v="Ethereum Sepolia" />
          <Row k="Mint transaction" v={mintUrl ? `${mintUrl.slice(-10)}… · tap to open` : 'Minting on Sepolia…'} mono={!!mintUrl} onPress={mintUrl ? () => Linking.openURL(mintUrl).catch(() => {}) : undefined} />
          <Row k="Location stored" v="Name and time. Never coordinates." last />
        </View>

        <InfoRow icon="information-circle-outline" title="Why can’t I send it?" body="A stamp means “I was there”. It stays with the person who captured it." />

        <PrimaryButton label="Share on X" icon="share-social" onPress={() => shareStamp(spot)} style={{ marginTop: 14 }} />
        <PrimaryButton label="View on Sepolia" tone="light" icon="open-outline" disabled={!mintUrl} onPress={() => mintUrl && Linking.openURL(mintUrl).catch(() => {})} style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v, mono, last, onPress }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, mono && { fontFamily: F.mono, fontSize: 12 }, onPress && { textDecorationLine: 'underline' }]}>{v}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((C) => ({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { height: 62, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: F.semi, fontSize: 16, color: C.ink },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20 },
  big: { width: 210, transform: [{ rotate: '-3deg' }] },
  name: { fontFamily: F.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.6, color: C.ink, textAlign: 'center', marginTop: 6 },
  sub: { fontFamily: F.reg, fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 5 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14, marginBottom: 20 },
  card: { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 18, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, gap: 16 },
  k: { fontFamily: F.reg, fontSize: 13, color: C.muted },
  v: { flex: 1, textAlign: 'right', fontFamily: F.semi, fontSize: 13, color: C.ink },
}));
