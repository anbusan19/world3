import { useRef } from 'react';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportImpression } from './world';
import { F, makeStyles } from './theme';

// An ad from a sponsor the organizer approved. Always labelled "SPONSORED"; its link opens only after a confirm.
// It shows on the capture result and again on the stamp's own page. An impression is counted once per person per campaign.
export function SponsorCard({ ad }) {
  const styles = useStyles();
  const counted = useRef(false);
  let host = '';
  try { host = new URL(ad.clickUrl).host; } catch { /* the server only sends https links */ }
  const seen = () => {
    if (counted.current) return;
    counted.current = true;
    reportImpression(ad.key);
  };
  const open = () =>
    Alert.alert(`Open ${host}?`, `This is a link from ${ad.sponsor}, a sponsor. It opens in your browser and leaves wrld3.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open', onPress: () => Linking.openURL(ad.clickUrl).catch(() => {}) },
    ]);
  return (
    <View style={styles.ad}>
      <View style={styles.adHead}>
        <Text style={styles.adTag}>SPONSORED</Text>
        <Text style={styles.adBy} numberOfLines={1}>{ad.sponsor}</Text>
      </View>
      <Image source={{ uri: ad.imageUrl }} style={[styles.adImg, { aspectRatio: ad.width / ad.height }]} resizeMode="cover" accessibilityLabel={ad.alt} onLoad={seen} />
      <Text style={styles.adTitle}>{ad.headline}</Text>
      <Pressable onPress={open} style={styles.adBtn} accessibilityRole="link">
        <Text style={styles.adBtnText}>Learn more</Text>
        <Ionicons name="open-outline" size={14} color={styles.adBtnText.color} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  ad: { alignSelf: 'stretch', marginTop: 22, backgroundColor: C.card, borderRadius: 24, padding: 14 },
  adHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  adTag: { fontFamily: F.semi, fontSize: 10, letterSpacing: 1.4, color: C.muted },
  adBy: { fontFamily: F.reg, fontSize: 12, color: C.muted, flexShrink: 1, marginLeft: 12 },
  adImg: { width: '100%', borderRadius: 16, backgroundColor: C.soft },
  adTitle: { fontFamily: F.semi, fontSize: 15, color: C.ink, marginTop: 12 },
  adBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6 },
  adBtnText: { fontFamily: F.semi, fontSize: 13, color: C.blue },
}));
