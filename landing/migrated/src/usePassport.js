import { useCallback, useEffect, useRef, useState } from 'react';
import { checkPassportName, getPassport, setPassportPublic, startPassport } from './world';

// The person's public passport, as the server sees it. Polls while it is being created (about a minute), so the screen updates on its own.
// state: { status: 'loading' | 'unavailable' | 'none' | 'creating' | 'ready' | 'error', name, url, path, published, stamps, error }
export function usePassport() {
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // the reason the last request was refused (for example, a name that is taken)
  const alive = useRef(true);
  const timer = useRef(null);

  const apply = useCallback((res) => {
    if (!alive.current) return;
    if (!res) return setState((s) => (s.status === 'loading' ? { status: 'unavailable' } : s));
    setState(res.passport);
  }, []);

  const refresh = useCallback(async () => apply(await getPassport()), [apply]);

  useEffect(() => {
    alive.current = true;
    refresh();
    return () => { alive.current = false; clearTimeout(timer.current); };
  }, [refresh]);

  // while it is being made, ask again every few seconds
  useEffect(() => {
    if (state.status !== 'creating') return undefined;
    timer.current = setTimeout(refresh, 4000);
    return () => clearTimeout(timer.current);
  }, [state, refresh]);

  const act = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try { apply(await fn()); } catch (e) { if (alive.current) setError(e?.message ?? null); await refresh(); } finally { if (alive.current) setBusy(false); }
  }, [apply, refresh]);

  return { passport: state, busy, error, check: checkPassportName, create: (label) => act(() => startPassport(label)), setPublic: (flag) => act(() => setPassportPublic(flag)), refresh };
}
