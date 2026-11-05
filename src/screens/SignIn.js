import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PassportHero } from '../art/OnboardingArt';
import { PrimaryButton } from '../ui';
import { F, makeStyles, useColors, useTheme } from '../theme';

// Frontend only: every button just continues. No account is created and nothing is stored.

export function SignIn({ onDone }) {
  const styles = useStyles();
  const C = useColors();
  const { isDark } = useTheme();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.brand}>
        {/* the light logo has black lettering; the dark one has white lettering */}
        <Image
          source={isDark ? require('../../assets/full-title-dark.png') : require('../../assets/full-title.png')}
          style={styles.title_img}
          resizeMode="contain"
        />
      </View>

      <View style={styles.hero}>
        <PassportHero badges={false} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>
          Create Your{'\n'}
          <Text style={styles.titleLight}>World3 Passport.</Text>
        </Text>
        <Text style={styles.sub}>
          Your personal travel passport to collect stamps, track places, and unlock rewards around the world.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Continue with Email" icon="mail-outline" onPress={onDone} />
        <Pressable style={({ pressed }) => [styles.google, pressed && { opacity: 0.85 }]} onPress={onDone}>
          <Ionicons name="logo-google" size={20} color={C.ink} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>
        <Pressable onPress={onDone} hitSlop={8} style={styles.passkey}>
          <Ionicons name="finger-print" size={18} color={C.muted} />
          <Text style={styles.passkeyText}>Use a passkey</Text>
        </Pressable>

        <View style={styles.note}>
          <View style={styles.noteIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={C.ink} />
          </View>
          <Text style={styles.noteText}>Create a World3 passport in seconds. It’s free, and it travels with you everywhere.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((C) => ({
  safe: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  brand: { alignItems: 'center', paddingTop: 6 },
  title_img: { width: 165, height: 55 }, // full-title.png is 3:1

  hero: { flex: 1, minHeight: 200, justifyContent: 'center', marginVertical: 6 },

  copy: { marginBottom: 18 },
  title: { fontFamily: F.black, fontSize: 32, lineHeight: 37, letterSpacing: -0.8, color: C.ink },
  titleLight: { fontFamily: F.med },
  sub: { fontFamily: F.med, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 10 },

  actions: { gap: 10, paddingBottom: 12 },
  google: { height: 58, borderRadius: 29, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleText: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  passkey: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  passkeyText: { fontFamily: F.bold, fontSize: 13, color: C.muted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, paddingHorizontal: 4 },
  noteIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  noteText: { flex: 1, fontFamily: F.med, fontSize: 11.5, lineHeight: 16, color: C.muted },
}));
