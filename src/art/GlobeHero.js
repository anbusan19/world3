import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { globeStyle } from '../mapStyle';

// The same slowly turning cartoon globe as the Globe tab, cut to a circle. Touches pass through it, so swiping the
// onboarding pages still works on top of it.
export function GlobeHero({ size = 240 }) {
  const camera = useRef(null);
  const lng = useRef(72);
  useEffect(() => {
    const id = setInterval(() => {
      lng.current = ((((lng.current + 9 + 180) % 360) + 360) % 360) - 180;
      camera.current?.easeTo({ center: [lng.current, 18], duration: 1000, easing: 'linear' });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const zoom = Math.log2((size * Math.PI) / 512) + 0.5; // the globe's width matches the circle
  return (
    <View pointerEvents="none" style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#0265AD' }}>
      <Map style={{ width: size, height: size }} mapStyle={globeStyle} androidView="texture" logo={false} compass={false} attribution={false} touchPitch={false} touchRotate={false}>
        <Camera ref={camera} initialViewState={{ center: [72, 18], zoom }} />
      </Map>
    </View>
  );
}
