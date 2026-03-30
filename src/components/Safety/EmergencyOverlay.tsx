import type { SOSAlert } from '../../hooks/useSOS';
import type { Ride } from '../../types';
import { formatFare } from '../../lib/fare';

interface EmergencyOverlayProps {
  alert: SOSAlert;
  ride: Ride;
  emergencyContact: { name: string; phone: string };
  onResolve: () => void;
  onClose: () => void;
}

export default function EmergencyOverlay({ alert, ride, emergencyContact, onResolve, onClose }: EmergencyOverlayProps) {
  const driverName = ride.driver?.full_name || 'Unknown';
  const vehicleInfo = ride.driver
    ? [ride.driver.vehicle_color, ride.driver.vehicle_make, ride.driver.vehicle_model].filter(Boolean).join(' ')
    : 'Unknown';
  const licensePlate = ride.driver?.license_plate || 'Unknown';

  const copyLocation = () => {
    const text = `EMERGENCY - TapRide SOS\nLocation: ${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}\nGoogle Maps: https://maps.google.com/?q=${alert.lat},${alert.lng}\nDriver: ${driverName}\nVehicle: ${vehicleInfo}\nPlate: ${licensePlate}\nTime: ${new Date(alert.created_at).toLocaleString()}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-red-600 z-50 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">SOS Alert Active</h1>
        <p className="text-red-100 text-sm mt-1">
          {new Date(alert.created_at).toLocaleTimeString()}
        </p>
      </div>

      {/* Info Cards */}
      <div className="flex-1 px-4 space-y-3 pb-4">
        {/* Location */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-4">
          <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Your Location</h3>
          <p className="text-white font-mono text-sm">
            {alert.lat.toFixed(6)}, {alert.lng.toFixed(6)}
          </p>
          <a
            href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-white underline"
          >
            Open in Google Maps →
          </a>
        </div>

        {/* Driver Info */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-4">
          <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Driver Information</h3>
          <div className="space-y-1 text-white text-sm">
            <p><span className="text-white/60">Name:</span> {driverName}</p>
            <p><span className="text-white/60">Vehicle:</span> {vehicleInfo}</p>
            <p><span className="text-white/60">Plate:</span> {licensePlate}</p>
          </div>
        </div>

        {/* Ride Info */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-4">
          <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Ride Details</h3>
          <div className="space-y-1 text-white text-sm">
            <p><span className="text-white/60">From:</span> {ride.pickup_address || 'Unknown'}</p>
            <p><span className="text-white/60">To:</span> {ride.destination_address || 'Unknown'}</p>
            <p><span className="text-white/60">Fare:</span> {formatFare(Number(ride.fare_estimate))}</p>
          </div>
        </div>

        {/* Emergency Contact */}
        {emergencyContact.phone && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Emergency Contact</h3>
            <p className="text-white text-sm font-semibold">{emergencyContact.name || 'Contact'}</p>
            <a
              href={`tel:${emergencyContact.phone}`}
              className="inline-flex items-center gap-2 mt-2 bg-white text-red-600 px-4 py-2 rounded-lg font-semibold text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call {emergencyContact.phone}
            </a>
          </div>
        )}

        {/* Call Zimbabwe Emergency */}
        <a
          href="tel:999"
          className="block w-full bg-white text-red-600 py-3 rounded-xl font-bold text-center text-lg"
        >
          📞 Call Emergency Services (999)
        </a>
      </div>

      {/* Bottom Actions */}
      <div className="px-4 pb-6 space-y-3">
        <button
          onClick={copyLocation}
          className="w-full py-3 rounded-xl border-2 border-white text-white font-semibold hover:bg-white/10 transition-colors"
        >
          Copy Emergency Info
        </button>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
          >
            Minimize
          </button>
          <button
            onClick={onResolve}
            className="flex-1 py-3 rounded-xl bg-white text-red-600 font-semibold hover:bg-white/90 transition-colors"
          >
            I'm Safe
          </button>
        </div>
      </div>
    </div>
  );
}
