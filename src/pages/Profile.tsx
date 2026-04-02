import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AlertError from '../components/ui/AlertError';
import ConfirmModal from '../components/ui/ConfirmModal';
import Footer from '../components/ui/Footer';

export default function Profile() {
  const { profile, updateProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [vehicleMake, setVehicleMake] = useState(profile?.vehicle_make || '');
  const [vehicleModel, setVehicleModel] = useState(profile?.vehicle_model || '');
  const [vehicleColor, setVehicleColor] = useState(profile?.vehicle_color || '');
  const [licensePlate, setLicensePlate] = useState(profile?.license_plate || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const isDriver = profile?.user_type === 'driver';

  // Sync local state when profile changes (e.g. after refresh)
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setVehicleMake(profile.vehicle_make || '');
      setVehicleModel(profile.vehicle_model || '');
      setVehicleColor(profile.vehicle_color || '');
      setLicensePlate(profile.license_plate || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const updates: Record<string, string> = {
        full_name: fullName,
        phone,
      };

      if (isDriver) {
        updates.vehicle_make = vehicleMake;
        updates.vehicle_model = vehicleModel;
        updates.vehicle_color = vehicleColor;
        updates.license_plate = licensePlate;
      }

      const { error: updateError } = await updateProfile(updates);
      if (updateError) {
        setError(updateError);
        return;
      }

      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setVehicleMake(profile?.vehicle_make || '');
    setVehicleModel(profile?.vehicle_model || '');
    setVehicleColor(profile?.vehicle_color || '');
    setLicensePlate(profile?.license_plate || '');
    setEditing(false);
    setError('');
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutConfirm(false);
    await signOut();
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 dark:from-gray-800 dark:to-gray-900 px-4 pt-8 pb-16">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
      </div>

      {/* Profile card */}
      <div className="px-4 -mt-10">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {(profile?.full_name || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {profile?.full_name || 'User'}
              </h2>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                isDriver
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {isDriver ? 'Driver' : 'Rider'}
              </span>
            </div>
            {profile?.rating != null && Number(profile.rating) > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Number(profile.rating).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Status messages */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4">
              <p className="text-green-600 dark:text-green-400 text-sm">Profile updated successfully</p>
            </div>
          )}
          {error && <AlertError message={error} className="mb-4" />}

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Full Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile?.full_name || '-'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white font-medium">
                {profile?.email || '-'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Phone
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile?.phone || '-'}
                </p>
              )}
            </div>

            {/* Vehicle info for drivers */}
            {isDriver && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Vehicle Information
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Make
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">
                        {profile?.vehicle_make || '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Model
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">
                        {profile?.vehicle_model || '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Color
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={vehicleColor}
                        onChange={(e) => setVehicleColor(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">
                        {profile?.vehicle_color || '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      License Plate
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">
                        {profile?.license_plate || '-'}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 space-y-3">
            {editing ? (
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Edit Profile
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="w-full py-3 rounded-xl border-2 border-red-500 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {showSignOutConfirm && (
        <ConfirmModal
          title="Sign Out"
          message="Are you sure you want to sign out?"
          confirmLabel="Sign Out"
          onConfirm={confirmSignOut}
          onCancel={() => setShowSignOutConfirm(false)}
          destructive
        />
      )}

      <Footer />
    </div>
  );
}
