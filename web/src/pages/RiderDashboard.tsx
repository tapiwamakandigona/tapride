/**
 * RiderDashboard — main screen for riders.
 * Shows a map of nearby drivers, lets them enter pickup/drop addresses,
 * estimates the fare, and creates a ride request.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

/** Geocode an address string using Nominatim */
async function geocode(address: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json() as GeoResult[];
    return data[0] ?? null;
  } catch (e) {
    logger.error('geocode', e);
    return null;
  }
}

/** Rider's home screen: map, booking form and driver list. */
const RiderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { nearbyDrivers } = useRideStore();
  const { fetchNearbyDrivers } = useDriverLocation();
  const { requestRide, loading, error } = useRide();

  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | undefined>();
  const [pickupLng, setPickupLng] = useState<number | undefined>();
  const [dropoffLat, setDropLat] = useState<number | undefined>();
  const [dropoffLng, setDropLng] = useState<number | undefined>();
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Get user location on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLng(longitude);
        setPickupLat(latitude);
        setPickupLng(longitude);

        // Reverse geocode for pickup label
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const data = await res.json() as { display_name?: string };
          if (data.display_name) setPickupAddress(data.display_name);
        } catch {
          setPickupAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }

        await fetchNearbyDrivers(latitude, longitude);
      },
      () => {
        logger.warn('Geolocation denied');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalculate fare whenever coords change
  useEffect(() => {
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const dist = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
      setFareEstimate(calculateFare(dist));
    } else {
      setFareEstimate(null);
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const handleDropGeocode = useCallback(async () => {
    if (!dropoffAddress.trim()) return;
    setGeocoding(true);
    const result = await geocode(dropoffAddress);
    setGeocoding(false);
    if (result) {
      setDropLat(parseFloat(result.lat));
      setDropLng(parseFloat(result.lon));
      setDropAddress(result.display_name);
    }
  }, [dropoffAddress]);

  const handleRequestRide = async () => {
    // Geocode dropoff if not yet resolved
    let lat = dropoffLat;
    let lng = dropoffLng;
    let addr = dropoffAddress;
    if ((!lat || !lng) && dropoffAddress.trim()) {
      setGeocoding(true);
      const result = await geocode(dropoffAddress);
      setGeocoding(false);
      if (!result) { return; }
      lat = parseFloat(result.lat);
      lng = parseFloat(result.lon);
      addr = result.display_name;
      setDropLat(lat);
      setDropLng(lng);
      setDropAddress(addr);
    }
    if (!pickupLat || !pickupLng || !lat || !lng) return;
    const distKm = haversineKm(pickupLat, pickupLng, lat, lng);
    const fare = calculateFare(distKm);
    const ride = await requestRide({
      pickupLat,
      pickupLng,
      pickupAddress,
      dropoffLat: lat,
      dropoffLng: lng,
      dropoffAddress: addr,
      fare,
      distanceKm: distKm,
    });
    if (ride) {
      navigate(`/ride/${ride.$id}`);
    }
  };

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

        {/* Pickup */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">Pickup</label>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Enter pickup location"
          />
        </div>

        {/* Drop */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">Drop-off</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => setDropAddress(e.target.value)}
              onBlur={handleDropGeocode}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Enter destination"
            />
            {geocoding && <LoadingSpinner size="sm" />}
          </div>
        </div>

        {/* Fare estimate */}
        {fareEstimate !== null && (
          <div className="rounded-xl bg-brand-50 border border-brand-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-600 font-medium">Estimated Fare</p>
                <p className="text-2xl font-bold text-brand-700">{formatFare(fareEstimate)}</p>
              </div>
              <div className="text-right text-sm text-brand-600">
                {pickupLat && pickupLng && dropoffLat && dropoffLng
                  ? `${haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng).toFixed(1)} km`
                  : ''}
              </div>
            </div>
          </div>
        )}

        {/* Request button */}
        <button
          onClick={handleRequestRide}
          type="button"
          disabled={loading || !pickupAddress.trim() || !dropoffAddress.trim()}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Request Ride 🚖'}
        </button>

        {/* Nearby drivers */}
        {nearbyDrivers.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Nearby Drivers ({nearbyDrivers.length})</h3>
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
    </div>
  );
};

export default RiderDashboard;
