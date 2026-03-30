import { useState } from 'react';
import { useSOS } from '../../hooks/useSOS';
import { useLocation as useGeoLocation } from '../../hooks/useLocation';
import EmergencyOverlay from './EmergencyOverlay';
import { heavyTap } from '../../lib/haptics';
import type { Ride } from '../../types';

interface SOSButtonProps {
  ride: Ride;
}

export default function SOSButton({ ride }: SOSButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const { activeAlert, loading, triggerSOS, resolveSOS, getEmergencyContact } = useSOS();
  const { position, getCurrentLocation } = useGeoLocation(false);

  const handleSOS = async () => {
    setShowConfirm(false);
    heavyTap();
    try {
      let lat = position?.lat ?? 0;
      let lng = position?.lng ?? 0;
      if (!lat && !lng) {
        try {
          const pos = await getCurrentLocation();
          lat = pos.lat;
          lng = pos.lng;
        } catch {
          // Use ride pickup as fallback
          lat = Number(ride.pickup_lat);
          lng = Number(ride.pickup_lng);
        }
      }
      await triggerSOS(ride, lat, lng);
      setShowOverlay(true);
    } catch (err) {
      console.error('[TapRide] SOS failed:', err);
    }
  };

  const handleResolve = async () => {
    if (activeAlert) {
      await resolveSOS(activeAlert.id);
    }
    setShowOverlay(false);
  };

  const emergencyContact = getEmergencyContact();

  return (
    <>
      {/* Floating SOS Button */}
      <button
        onClick={() => activeAlert ? setShowOverlay(true) : setShowConfirm(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg shadow-red-600/40 flex items-center justify-center font-bold text-sm transition-all active:scale-95"
        aria-label="SOS Emergency"
      >
        {activeAlert ? (
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
        ) : (
          'SOS'
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Emergency SOS confirmation"
          onKeyDown={(e) => { if (e.key === 'Escape') setShowConfirm(false); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
              Emergency SOS
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              This will record your location and send an emergency alert.
              {emergencyContact.phone && (
                <span className="block mt-1">
                  Emergency contact: <strong>{emergencyContact.name || emergencyContact.phone}</strong>
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSOS}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold transition-colors"
              >
                {loading ? 'Sending...' : 'Send SOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Overlay */}
      {showOverlay && activeAlert && (
        <EmergencyOverlay
          alert={activeAlert}
          ride={ride}
          emergencyContact={emergencyContact}
          onResolve={handleResolve}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </>
  );
}
