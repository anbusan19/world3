'use client';
import { View } from 'react-native';
import { ThemeProvider } from '@/migrated/src/theme';
import { Art, SLIDES } from '@/migrated/src/Onboarding';

// The three artworks from the app's onboarding, drawn by the app's own code.
export default function OnboardingArts({ index }) {
  return (
    <ThemeProvider>
      <View style={{ height: 340, width: index === 0 ? 330 : '100%', maxWidth: '100%', marginHorizontal: 'auto', alignItems: 'stretch' }}>
        <Art slide={SLIDES[index]} />
      </View>
    </ThemeProvider>
  );
}
