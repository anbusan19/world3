'use client';
import dynamic from 'next/dynamic';

// Everything built from the app's own React Native components is drawn in the browser only (react-native-web).
const loading = () => <div className="rn-loading" aria-hidden="true" />;
export const AppPhone = dynamic(() => import('./AppPhone'), { ssr: false, loading });
export const PassportBook = dynamic(() => import('./PassportBook'), { ssr: false, loading });
export const OnboardingArts = dynamic(() => import('./OnboardingArts'), { ssr: false, loading });
export const WalkPhone = dynamic(() => import('./WalkPhone'), { ssr: false, loading });
export const HeroGlobe = dynamic(() => import('./HeroGlobe'), { ssr: false, loading: () => null });
export const Flow = dynamic(() => import('./Flow'), { ssr: false, loading: () => null });
