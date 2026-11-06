import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PassportHero } from '../art/OnboardingArt';
import { PrimaryButton } from '../ui';
import { CaptureFailure, signInWithWorldId } from '../world';
import { F, makeStyles, useColors, useTheme } from '../theme';

// Sign in with World ID: proving you are a unique human is the only way in, and it is your account. No email, no password.
const STAGES = ['Requesting a one-time code', 'Approve in World App', 'Server checking your proof'];

export function SignIn({ onDone }) {
  const [stage, setStage] = useState(null); // null while idle, else 0..2
  const [error, setError] = useState(null);
  const styles = useStyles();
  const C = useColors();
  const { isDark } = useTheme();
  async function start() {
    setError(null);
    setStage(0);
    try {
      const user = await signInWithWorldId({ onStage: setStage });
      onDone(user);
    } catch (e) {
      setStage(null);
      setError(e instanceof CaptureFailure ? e.message : 'Something went wrong. Try again.');
    }
  }

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
          One human, one passport. Sign in with World ID to collect stamps from real places.
        </Text>
      </View>

      <View style={styles.actions}>
        {stage === null ? (
          <PrimaryButton label="Continue with World ID" icon="shield-checkmark" onPress={start} />
        ) : (
          <View style={styles.progress}>
            {STAGES.map((label, i) => (
              <View key={label} style={styles.stepRow}>
                <View style={[styles.stepIcon, stage > i && { backgroundColor: C.green }]}>
                  {stage > i ? <Ionicons name="checkmark" size={16} color="#0B0B0F" /> : stage === i ? <ActivityIndicator size="small" color={C.ink} /> : null}
                </View>
                <Text style={[styles.stepText, stage >= i && { color: C.ink, fontFamily: F.semi }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.note}>
          <View style={styles.noteIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={C.ink} />
          </View>
          <Text style={styles.noteText}>World ID proves you are a unique person without telling us who you are. You need World App on this phone.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((C) => ({
  progress: { backgroundColor: C.card, borderRadius: 24, padding: 18, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontFamily: F.reg, fontSize: 14, color: C.muted },
  error: { fontFamily: F.semi, fontSize: 13, color: C.orange, textAlign: 'center', marginTop: 12 },
  safe: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  brand: { alignItems: 'center', paddingTop: 6 },
  title_img: { width: 165, height: 55 }, // full-title.png is 3:1

  hero: { flex: 1, minHeight: 200, justifyContent: 'center', marginVertical: 6 },

  copy: { marginBottom: 18 },
  title: { fontFamily: F.bold, fontSize: 32, lineHeight: 37, letterSpacing: -0.8, color: C.ink },
  titleLight: { fontFamily: F.reg },
  sub: { fontFamily: F.reg, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 10 },

  actions: { gap: 10, paddingBottom: 12 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, paddingHorizontal: 4 },
  noteIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  noteText: { flex: 1, fontFamily: F.reg, fontSize: 11.5, lineHeight: 16, color: C.muted },
}));
