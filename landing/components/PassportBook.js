'use client';
import { ThemeProvider } from '@/migrated/src/theme';
import { Stamp } from '@/migrated/src/Stamp';
import { View } from 'react-native';

// Three real stamps from the app (same drawing code as src/Stamp.js) and three still locked.
const ITEMS = [
  { art: 'gateway', icon: 'business', label: 'GATEWAY', theme: 'coral', tag: '01' },
  { art: 'ethglobal', icon: 'ticket', label: 'ETHGLOBAL', theme: 'sky', tag: '02' },
  { art: 'csmt', icon: 'train', label: 'CSMT', theme: 'sun', tag: '03' },
  { art: 'none', icon: 'boat', label: 'MARINE DR', theme: 'ocean', tag: '04', locked: true },
  { art: 'none', icon: 'leaf', label: 'ELEPHANTA', theme: 'leaf', tag: '05', locked: true },
  { art: 'none', icon: 'water', label: 'JUHU', theme: 'coral', tag: '06', locked: true },
];

export default function PassportBook() {
  return (
    <ThemeProvider>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {ITEMS.map((s) => (
          <View key={s.tag} style={{ width: 'calc(33.3% - 10px)', minWidth: 90, flexGrow: 1 }}>
            <Stamp theme={s.theme} art={s.art} icon={s.icon} label={s.label} tag={s.tag} locked={s.locked} iconSize={40} labelSize={12} />
          </View>
        ))}
      </View>
    </ThemeProvider>
  );
}
