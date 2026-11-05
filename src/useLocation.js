import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

// The phone's position as [lng, lat] with its accuracy in metres, and how it was found.
//   status: 'asking' | 'searching' | 'granted' | 'denied' | 'error'   ('searching' = allowed, waiting for the first fix)
//   source: 'last' (the phone's last known fix) | 'network' (Wi-Fi/cell, coarse) | 'gps' (a live fix)
// It starts from whatever is known right away, then improves: last known -> a quick network fix -> live GPS updates, so the
// map and distances appear in a second or two instead of waiting for GPS to lock (which can take a minute indoors).
// `retry()` starts over (for example after the person turns location on in settings).
export function useLocation() {
  const [state, setState] = useState({ status: 'asking', coords: null, accuracy: null, source: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const best = useRef(Infinity); // best accuracy seen, so a coarse fix never replaces a better one

  useEffect(() => {
    let cancelled = false;
    let sub = null;
    best.current = Infinity;
    setState((s) => ({ ...s, status: s.coords ? s.status : 'asking', error: null }));

    // a coarse fix may be replaced by a better one, or by any live GPS fix; a live fix is always newer than a cached one
    const accept = (loc, source) => {
      if (cancelled || !loc?.coords) return;
      const acc = loc.coords.accuracy ?? 9999;
      if (source !== 'gps' && acc > best.current) return;
      if (source === 'gps') best.current = acc; else best.current = Math.min(best.current, acc);
      setState({ status: 'granted', coords: [loc.coords.longitude, loc.coords.latitude], accuracy: acc, source, error: null, at: loc.timestamp ?? Date.now() });
    };

    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          setState((s) => ({ ...s, status: 'denied', error: 'Location permission is off for World3.' }));
          return;
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          setState((s) => ({ ...s, status: 'error', error: 'Turn on Location in your phone settings.' }));
          return;
        }
        setState((s) => (s.coords ? s : { ...s, status: 'searching' }));

        // 1. instant: the last place the phone knew (may be old, so it is marked source 'last')
        Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).then((l) => accept(l, 'last')).catch(() => {});
        // 2. quick: a Wi-Fi/cell fix, coarse but usually within a couple of seconds
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((l) => accept(l, 'network')).catch(() => {});
        // 3. live: GPS updates that keep coming as you walk
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000 },
          (loc) => accept(loc, 'gps'),
        );
        if (cancelled) sub.remove();
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: s.coords ? s.status : 'error', error: String(e?.message ?? e) }));
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [attempt]);

  return { ...state, retry };
}
