import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { F, makeStyles, useColors } from './theme';

// Over the (always dark) AR view the back button is a fixed white circle (light); everywhere else it is the solid one.
export function BackButton({ onPress, icon = 'arrow-back', light }) {
  const styles = useStyles();
  const C = useColors();
  return (
    <Pressable style={[styles.back, light && { backgroundColor: '#FFFFFF' }]} onPress={onPress} hitSlop={8}>
      <Ionicons name={icon} size={22} color={light ? '#0B0B0F' : C.onSolid} />
    </Pressable>
  );
}

// tone: 'ink' (solid: black in light, near-white in dark), 'green', 'light' (card colour), 'disabled'
export function PrimaryButton({ label, onPress, tone = 'ink', icon, disabled, style }) {
  const styles = useStyles();
  const C = useColors();
  const t = disabled ? 'disabled' : tone;
  const look = {
    ink: { bg: C.solid, fg: C.onSolid },
    green: { bg: C.green, fg: '#0B0B0F' },
    light: { bg: C.card, fg: C.ink },
    disabled: { bg: C.line, fg: '#9A9EA8' },
  }[t];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: look.bg }, pressed && { opacity: 0.88 }, style]}
    >
      {icon && <Ionicons name={icon} size={20} color={look.fg} />}
      <Text style={[styles.btnText, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function InfoRow({ icon, title, body, tint }) {
  const styles = useStyles();
  const C = useColors();
  tint = tint ?? C.info;
  return (
    <View style={styles.info}>
      <View style={[styles.infoIcon, { backgroundColor: tint + '22' }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        {body ? <Text style={styles.infoBody}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function Chip({ label, icon, tone = 'light' }) {
  const styles = useStyles();
  const C = useColors();
  const bg = tone === 'ink' ? C.solid : tone === 'green' ? C.green : C.card;
  const fg = tone === 'ink' ? C.onSolid : tone === 'green' ? '#0B0B0F' : C.ink;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={13} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  back: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.solid, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 58, borderRadius: 29, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: F.bold, fontSize: 16 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 8 },
  infoIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  infoBody: { fontFamily: F.med, fontSize: 12, lineHeight: 17, color: C.muted, marginTop: 3 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 30, borderRadius: 15 },
  chipText: { fontFamily: F.bold, fontSize: 11 },
}));
