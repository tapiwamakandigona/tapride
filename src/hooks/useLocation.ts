import { useState, useCallback, useEffect, useRef } from 'react';
import type { GeoPosition } from '../types';

export function useLocation(autoStart = true) {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getCurrentLocation = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation not supported';
        setError(msg);
        setLocationUnavailable(true);
        reject(new Error(msg));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geo: GeoPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };
          if (mountedRef.current) {
            setPosition(geo);
            setError(null);
            setLocationUnavailable(false);
          }
          resolve(geo);
        },
        (err) => {
          if (mountedRef.current) {
            setError(err.message);
            // Permission denied or position unavailable → mark unavailable
            if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
              setLocationUnavailable(true);
            }
          }
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
      );
    });
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return () => {};
    }

    // Don't double-watch
    if (watchIdRef.current !== null) {
      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          if (mountedRef.current) setWatching(false);
        }
      };
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (mountedRef.current) {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          });
          setError(null);
        }
      },
      (err) => { if (mountedRef.current) setError(err.message); },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
    );

    watchIdRef.current = id;
    if (mountedRef.current) setWatching(true);

    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
      if (mountedRef.current) setWatching(false);
    };
  }, []);

  // Auto-get current location on mount so riders see their position immediately
  useEffect(() => {
    if (autoStart && !position) {
      getCurrentLocation().catch(() => {
        // Silently fail — error state is already set
      });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { position, error, watching, locationUnavailable, getCurrentLocation, startWatching };
}
