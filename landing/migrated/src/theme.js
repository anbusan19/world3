import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ------------------------------------------------------------------------------------------------------------
// Colours
//
// ACCENT colours are the brand palette (logo blue + green, orange, pastels). They look the same in light and dark.
// The rest are roles that change with the theme:
//   bg / card      page background and the raised surface on it
//   ink / muted    primary and secondary text
//   line           hairlines and dividers
//   solid/onSolid  primary buttons, active tab, selected chip (black in light, near-white in dark) and the text on them
//   info           the brand blue used as text or an icon (brighter in dark so it stays readable)
//   panel          big feature cards, toasts and info chips (black in light, an elevated grey in dark); text on it is white
// ------------------------------------------------------------------------------------------------------------
export const ACCENT = {
  blue: '#0265AD',
  green: '#A6D16C',
  orange: '#F26B21',
  sky: '#BFE3EC',
  peach: '#F9C9B0',
  sun: '#F6E27A',
};

export const LIGHT = {
  ...ACCENT,
  bg: '#F4F5F8',
  card: '#FFFFFF',
  ink: '#0B0B0F',
  muted: '#7C808A',
  line: '#E6E8EE',
  solid: '#0B0B0F',
  onSolid: '#FFFFFF',
  panel: '#0B0B0F',
  onPanel: '#FFFFFF',
  soft: '#F4F5F8', // a quiet fill inside a card (inactive pills, inactive tab buttons)
  info: '#0265AD', // the brand blue when it is TEXT or an ICON (on a dark page it needs to be brighter)
};

export const DARK = {
  ...ACCENT,
  bg: '#0D0F14',
  card: '#1A1E26',
  ink: '#F3F4F7',
  muted: '#9AA1AF',
  line: '#2A2F3A',
  solid: '#F3F4F7',
  onSolid: '#0B0B0F',
  panel: '#272C37',
  onPanel: '#FFFFFF',
  soft: '#252A34',
  info: '#4DA3E8',
};

// Kept so any stray module-level reference still resolves; components should use useColors().
export const C = LIGHT;

// ------------------------------------------------------------------------------------------------------------
// Provider
//   mode: 'system' | 'light' | 'dark'. The choice is remembered on the device.
// ------------------------------------------------------------------------------------------------------------
const KEY = 'world3.theme';
const ThemeContext = createContext({ mode: 'system', setMode: () => {}, isDark: false, colors: LIGHT });

export function ThemeProvider({ children }) {
  const system = 'light'; // the landing page always shows the light theme
  const [mode, setModeState] = useState('system');
  const [ready, setReady] = useState(false); // false until the saved choice is read, so the wrong theme never flashes

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setMode = useCallback((m) => {
    setModeState(m);
    SecureStore.setItemAsync(KEY, m).catch(() => {});
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo(() => ({ mode, setMode, isDark, colors: isDark ? DARK : LIGHT }), [mode, setMode, isDark]);
  if (!ready) return null; // the splash screen stays up meanwhile (it is hidden once the first screen lays out)
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

// Themed StyleSheet: `const useStyles = makeStyles((C) => ({ ... }))`, then `const styles = useStyles()` in a component.
// Each theme's sheet is built once and reused.
export function makeStyles(factory) {
  const cache = new Map();
  return function useStyles() {
    const { colors } = useContext(ThemeContext);
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = StyleSheet.create(factory(colors));
      cache.set(colors, sheet);
    }
    return sheet;
  };
}

// Colour sets for the illustrated stamps: frame (perforated border), sky, two hill tones, and the accent used
// for the landmark and label. Pastel frames follow the stamp reference; the green and blue ones come from the logo.
// Stamps are illustrations, so they look the same in both themes.
export const STAMP_THEMES = {
  coral: { frame: '#F9A98B', sky: '#FFE9D6', hill: '#F7C59F', hill2: '#F2A065', accent: '#D9481C' },
  sky: { frame: '#8FD3E4', sky: '#E6F7FB', hill: '#B7E4D3', hill2: '#6FBF9C', accent: '#0A6EA6' },
  sun: { frame: '#F4D35E', sky: '#FFF7D1', hill: '#F9D77E', hill2: '#EFA93A', accent: '#B45F06' },
  leaf: { frame: '#A6D16C', sky: '#EDF7DA', hill: '#8CC152', hill2: '#5F9E2F', accent: '#2F6B14' },
  ocean: { frame: '#3D8FD0', sky: '#D6EAF8', hill: '#7FB8E3', hill2: '#0265AD', accent: '#0B4F86' },
};

export const F = {
  med: 'PlusJakartaSans_500Medium',
  bold: 'PlusJakartaSans_700Bold',
  black: 'PlusJakartaSans_800ExtraBold',
};
