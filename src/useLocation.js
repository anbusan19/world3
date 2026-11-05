import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

// Live GPS position as [lng, lat] with its accuracy in metres (best available: GPS, not just Wi-Fi/cell). status: 'asking' | 'granted' | 'denied' | 'error'.
export function useLocation() {
  const [state, setState] = useState({ status: 'asking', coords: null });

  useEffect(() => {
    let cancelled = false;
    let sub = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setState({ status: 'denied', coords: null });
          return;
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
          (loc) => {
            if (!cancelled) setState({ status: 'granted', coords: [loc.coords.longitude, loc.coords.latitude], accuracy: loc.coords.accuracy });
          },
        );
        if (cancelled) sub.remove();
      } catch {
        if (!cancelled) setState({ status: 'error', coords: null });
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return state;
}
