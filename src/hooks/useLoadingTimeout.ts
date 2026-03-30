import { useState, useEffect, useRef } from 'react';

/**
 * Returns { slow, timedOut } based on how long `loading` has been true.
 * - slow: true after `slowMs` (default 5s) — show "Taking longer than expected..."
 * - timedOut: true after `timeoutMs` (default 10s) — show retry UI
 */
export function useLoadingTimeout(loading: boolean, slowMs = 5000, timeoutMs = 10000) {
  const [slow, setSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      setTimedOut(false);
      startRef.current = null;
      return;
    }

    startRef.current = Date.now();

    const slowTimer = setTimeout(() => setSlow(true), slowMs);
    const timeoutTimer = setTimeout(() => setTimedOut(true), timeoutMs);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    };
  }, [loading, slowMs, timeoutMs]);

  return { slow, timedOut };
}
