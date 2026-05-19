/**
 * RiderDashboard — main screen for riders.
 * Shows a map of nearby drivers, lets them enter pickup/drop addresses,
 * estimates the fare, and creates a ride request.
 *
 * UX improvements:
 *  - Pickup shows "Detecting your location…" while GPS resolves (fix 3)
 *  - Address suggestions dropdown as user types (fix 4)
 *  - Geocoding spinner + "Searching…" feedback (fix 2)
 *  - Fare preview confirm sheet before booking (fix 1)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { MapView } from '@/components/MapView';
import { DriverCard } from '@/components/DriverCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useRide } from '@/hooks/useRide';
import { useRideStore } from '@/store/rideStore';
import { useAuthStore } from '@/store/authStore';
import { haversineKm } from '@/lib/geo';
import { calculateFare, formatFare } from '@/lib/fare';
import type { GeoResult } from '@/types';
import { logger } from '@/lib/logger';

// ─── Nominatim helpers ────────────────────────────────────────────────────────

/** Geocode a full address string → single best result */
async function geocode(address: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = (await res.json()) as GeoResult[];
    return data[0] ?? null;
  } catch (e) {
    logger.error('geocode', e);
    return null;
  }
}

/** Fetch up to 5 address suggestions for autocomplete */
async function fetchSuggestions(query: string): Promise<GeoResult[]> {
  if (query.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    return (await res.json()) as GeoResult[];
  } catch {
    return [];
  }
}

// ─── Suggestion dropdown ──────────────────────────────────────────────────────

interface SuggestionListProps {
  items: GeoResult[];
  onSelect: (item: GeoResult) => void;
}

const SuggestionList: React.FC<SuggestionListProps> = ({ items, onSelect }) => {
  if (items.length === 0) return null;
  return (
    <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg text-sm overflow-hidden">
      {items.map((item) => (
        <li
          key={item.place_id ?? item.display_name}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          className="px-3 py-2 cursor-pointer hover:bg-brand-50 border-b border-gray-100 last:border-0 truncate"
        >
          {item.display_name}
        </li>
      ))}
    </ul>
  );
};

// ─── Fare confirm sheet ───────────────────────────────────────────────────────

interface FareConfirmProps {
  fare: number;
  distKm: number;
  pickupAddress: string;
  dropoffAddress: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const FareConfirmSheet: React.FC<FareConfirmProps> = ({
  fare, distKm, pickupAddress, dropoffAddress, loading, onConfirm, onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
    <div
      className="w-full max-w-md rounded-t-2xl bg-white p-6 pb-8 space-y-4 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-bold text-gray-900 text-center">Confirm your ride</h3>

      <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 text-center">
        <p className="text-xs text-brand-600 font-medium mb-1">Estimated Fare</p>
        <p className="text-4xl font-extrabold text-brand-700">{formatFare(fare)}</p>
        <p className="text-sm text-brand-500 mt-1">{distKm.toFixed(1)} km</p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Pickup</p>
            <p className="text-gray-700 line-clamp-2">{pickupAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Drop-off</p>
            <p className="text-gray-700 line-clamp-2">{dropoffAddress}</p>
          </div>
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <LoadingSpinner size="sm" /> : '🚖 Confirm Ride'}
      </button>
      <button
        onClick={onClose}
        disabled={loading}
        className="w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const RiderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { nearbyDrivers } = useRideStore();
  const { fetchNearbyDrivers } = useDriverLocation();
  const { requestRide, loading, error } = useRide();

  // On mount: redirect to active ride if one exists in Appwrite
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.RIDES, [
          Query.equal('riderId', user.$id),
          Query.notEqual('status', 'completed'),
          Query.notEqual('status', 'cancelled'),
          Query.orderDesc('$createdAt'),
          Query.limit(5),
        ]);
        if (res.documents.length > 0) {
          // prefer inprogress > accepted > pending
          const priority = ['inprogress', 'accepted', 'pending'];
          const sorted = res.documents.sort((a, b) => {
            const ai = priority.indexOf(a.status);
            const bi = priority.indexOf(b.status);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          });
          navigate(`/ride/${sorted[0].$id}`, { replace: true });
        }
      } catch {
        // no active ride, stay on dashboard
      }
    })();
  }, [user, navigate]);

  const [detectingLocation, setDetectingLocation] = useState(true);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();

  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | undefined>();
  const [pickupLng, setPickupLng] = useState<number | undefined>();
  const [dropoffLat, setDropoffLat] = useState<number | undefined>();
  const [dropoffLng, setDropoffLng] = useState<number | undefined>();

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState('');

  // Suggestions
  const [pickupSuggestions, setPickupSuggestions] = useState<GeoResult[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<GeoResult[]>([]);
  const pickupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm sheet
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingRideRef = useRef<{
    pLat: number; pLng: number; pAddr: string;
    lat: number; lng: number; addr: string;
    fare: number; distKm: number;
  } | null>(null);

  // ── GPS on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    setDetectingLocation(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLng(longitude);
        setPickupLat(latitude);
        setPickupLng(longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const data = (await res.json()) as { display_name?: string };
          if (data.display_name) setPickupAddress(data.display_name);
        } catch {
          setPickupAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setDetectingLocation(false);
        await fetchNearbyDrivers(latitude, longitude);
      },
      () => {
        logger.warn('Geolocation denied');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Autocomplete: pickup ──────────────────────────────────────────────────
  const handlePickupChange = (val: string) => {
    setPickupAddress(val);
    setPickupLat(undefined);
    setPickupLng(undefined);
    if (pickupDebounce.current) clearTimeout(pickupDebounce.current);
    pickupDebounce.current = setTimeout(async () => {
      const results = await fetchSuggestions(val);
      setPickupSuggestions(results);
    }, 350);
  };

  const selectPickup = (item: GeoResult) => {
    setPickupAddress(item.display_name);
    setPickupLat(parseFloat(item.lat));
    setPickupLng(parseFloat(item.lon));
    setPickupSuggestions([]);
  };

  // ── Autocomplete: dropoff ─────────────────────────────────────────────────
  const handleDropoffChange = (val: string) => {
    setDropoffAddress(val);
    setDropoffLat(undefined);
    setDropoffLng(undefined);
    if (dropoffDebounce.current) clearTimeout(dropoffDebounce.current);
    dropoffDebounce.current = setTimeout(async () => {
      const results = await fetchSuggestions(val);
      setDropoffSuggestions(results);
    }, 350);
  };

  const selectDropoff = (item: GeoResult) => {
    setDropoffAddress(item.display_name);
    setDropoffLat(parseFloat(item.lat));
    setDropoffLng(parseFloat(item.lon));
    setDropoffSuggestions([]);
  };

  // ── Step 1: resolve coords then show confirm sheet ────────────────────────
  const handleRequestRide = useCallback(async () => {
    let pLat = pickupLat;
    let pLng = pickupLng;
    let pAddr = pickupAddress;

    if ((!pLat || !pLng) && pickupAddress.trim()) {
      setGeocoding(true);
      setGeocodeMsg('Searching pickup…');
      const result = await geocode(pickupAddress);
      setGeocoding(false);
      setGeocodeMsg('');
      if (!result) return;
      pLat = parseFloat(result.lat);
      pLng = parseFloat(result.lon);
      pAddr = result.display_name;
      setPickupLat(pLat);
      setPickupLng(pLng);
      setPickupAddress(pAddr);
    }

    let dLat = dropoffLat;
    let dLng = dropoffLng;
    let dAddr = dropoffAddress;

    if ((!dLat || !dLng) && dropoffAddress.trim()) {
      setGeocoding(true);
      setGeocodeMsg('Searching drop-off…');
      const result = await geocode(dropoffAddress);
      setGeocoding(false);
      setGeocodeMsg('');
      if (!result) return;
      dLat = parseFloat(result.lat);
      dLng = parseFloat(result.lon);
      dAddr = result.display_name;
      setDropoffLat(dLat);
      setDropoffLng(dLng);
      setDropoffAddress(dAddr);
    }

    if (!pLat || !pLng || !dLat || !dLng) return;

    const distKm = haversineKm(pLat, pLng, dLat, dLng);
    const fare = calculateFare(distKm);
    pendingRideRef.current = { pLat, pLng, pAddr, lat: dLat, lng: dLng, addr: dAddr, fare, distKm };
    setShowConfirm(true);
  }, [pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress]);

  // ── Step 2: user confirmed → create ride ─────────────────────────────────
  const handleConfirm = async () => {
    const p = pendingRideRef.current;
    if (!p) return;
    const ride = await requestRide({
      pickupLat: p.pLat,
      pickupLng: p.pLng,
      pickupAddress: p.pAddr,
      dropoffLat: p.lat,
      dropoffLng: p.lng,
      dropoffAddress: p.addr,
      fare: p.fare,
      distanceKm: p.distKm,
    });
    if (ride) navigate(`/ride/${ride.$id}`);
  };

  const farePreview =
    pickupLat && pickupLng && dropoffLat && dropoffLng
      ? calculateFare(haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng))
      : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Map */}
      <MapView
        userLat={userLat}
        userLng={userLng}
        drivers={nearbyDrivers}
        pickupLat={pickupLat}
        pickupLng={pickupLng}
        dropoffLat={dropoffLat}
        dropoffLng={dropoffLng}
        showRoute={!!(dropoffLat && dropoffLng)}
        className="h-56 flex-shrink-0"
      />

      {/* Booking panel */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Where to?</h2>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Geocoding feedback */}
        {(geocoding || geocodeMsg) && (
          <div className="flex items-center gap-2 text-sm text-brand-600">
            <LoadingSpinner size="sm" />
            <span>{geocodeMsg || 'Searching…'}</span>
          </div>
        )}

        {/* Pickup */}
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">
            Pickup
          </label>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => handlePickupChange(e.target.value)}
            onBlur={() => setTimeout(() => setPickupSuggestions([]), 150)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder={detectingLocation ? '📍 Detecting your location…' : 'Enter pickup location'}
            disabled={detectingLocation}
          />
          {detectingLocation && (
            <div className="absolute right-3 top-8">
              <LoadingSpinner size="sm" />
            </div>
          )}
          <SuggestionList items={pickupSuggestions} onSelect={selectPickup} />
        </div>

        {/* Drop-off */}
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">
            Drop-off
          </label>
          <input
            type="text"
            value={dropoffAddress}
            onChange={(e) => handleDropoffChange(e.target.value)}
            onBlur={() => setTimeout(() => setDropoffSuggestions([]), 150)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Enter destination"
          />
          <SuggestionList items={dropoffSuggestions} onSelect={selectDropoff} />
        </div>

        {/* Fare preview (before confirming) */}
        {farePreview !== null && (
          <div className="rounded-xl bg-brand-50 border border-brand-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-600 font-medium">Estimated Fare</p>
                <p className="text-2xl font-bold text-brand-700">{formatFare(farePreview)}</p>
              </div>
              <div className="text-right text-sm text-brand-600">
                {pickupLat && pickupLng && dropoffLat && dropoffLng
                  ? `${haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng).toFixed(1)} km`
                  : ''}
              </div>
            </div>
          </div>
        )}

        {/* Request button → opens confirm sheet */}
        <button
          onClick={handleRequestRide}
          type="button"
          disabled={geocoding || !pickupAddress.trim() || !dropoffAddress.trim()}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {geocoding ? <LoadingSpinner size="sm" /> : 'Request Ride 🚖'}
        </button>

        {/* Nearby drivers */}
        {nearbyDrivers.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Nearby Drivers ({nearbyDrivers.length})
            </h3>
            <div className="space-y-2">
              {nearbyDrivers.map((d) => (
                <DriverCard
                  key={d.driverId}
                  driver={d}
                  userLat={userLat ?? 0}
                  userLng={userLng ?? 0}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fare confirm sheet */}
      {showConfirm && pendingRideRef.current && (
        <FareConfirmSheet
          fare={pendingRideRef.current.fare}
          distKm={pendingRideRef.current.distKm}
          pickupAddress={pendingRideRef.current.pAddr}
          dropoffAddress={pendingRideRef.current.addr}
          loading={loading}
          onConfirm={handleConfirm}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

export default RiderDashboard;
