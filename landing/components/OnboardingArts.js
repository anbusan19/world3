'use client';
import { View } from 'react-native';
import { ThemeProvider } from '@/migrated/src/theme';
import { Art, SLIDES } from '@/migrated/src/Onboarding';

const Pin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B0B0F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21Zm0-8.6a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" /></svg>
);

// Slide 1: the app's rotating globe, with the things the map shows around it (these extras are the landing page's own).
function GoThere() {
  return (
    <div className="goscene">
      <ThemeProvider>
        <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Art slide={SLIDES[0]} />
        </View>
      </ThemeProvider>

      {/* the radii around a spot: where it shows up, and where it unlocks */}
      <div className="gs-radii" aria-hidden="true">
        <svg viewBox="0 0 140 140" width="100%" height="100%">
          <circle cx="70" cy="70" r="64" fill="none" stroke="#0265AD" strokeWidth="2" strokeDasharray="6 6" />
          <circle cx="70" cy="70" r="30" fill="#A6D16C" fillOpacity=".5" stroke="#5F9E2F" strokeWidth="2.5" />
          <circle cx="70" cy="70" r="9" fill="#F9C9B0" stroke="#fff" strokeWidth="3.5" />
          <circle className="gs-you" cx="30" cy="104" r="6" fill="#0B0B0F" />
        </svg>
        <span>Approach 100 m</span><span>Capture 20 m</span>
      </div>

      <div className="gs-chip gs-dist"><i><Pin /></i><span><b>Gateway of India</b>120 m away · keep walking</span></div>
      <div className="gs-chip gs-count"><i className="live" /><span><b>19 spots</b>around Mumbai</span></div>
      <div className="gs-chip gs-coin" aria-hidden="true"><svg viewBox="0 0 40 40" width="34" height="34"><circle cx="20" cy="20" r="18" fill="#F6E27A" stroke="#0B0B0F" strokeWidth="2.5" /><circle cx="20" cy="20" r="11" fill="none" stroke="#0B0B0F" strokeWidth="2" strokeDasharray="3 3" /><path d="M14 20.5l4 4 8-9" fill="none" stroke="#0B0B0F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg><span><b>3D coin</b>unlocks when you arrive</span></div>
      <svg className="gs-path" viewBox="0 0 300 120" aria-hidden="true"><path d="M6 108C60 100 70 40 130 52S220 20 292 8" fill="none" stroke="#0265AD" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" /></svg>
    </div>
  );
}

// The three artworks from the app's onboarding, drawn by the app's own code.
export default function OnboardingArts({ index }) {
  if (index === 0) return <GoThere />;
  return (
    <ThemeProvider>
      <View style={{ height: 340, width: '100%', maxWidth: '100%', marginHorizontal: 'auto', alignItems: 'stretch' }}>
        <Art slide={SLIDES[index]} />
      </View>
    </ThemeProvider>
  );
}
