/**
 * Profile page — view and edit the current user's profile.
 */
import React, { useState } from 'react';
import { AppwriteException } from 'appwrite';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { logger } from '@/lib/logger';

/** User profile editor with logout button. */
const Profile: React.FC = () => {
  const { user, profile, setProfile } = useAuthStore();
  const { logout } = useAuth();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [vehicleType, setVehicleType] = useState(profile?.vehicleType ?? '');
  const [licensePlate, setLicensePlate] = useState(profile?.licensePlate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setError(null);
    setSaving(true);
    try {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.PROFILES,
        profile.$id,
        { name: fullName, phone, vehicleType: vehicleType || null, licensePlate: licensePlate || null },
      );
      setProfile(doc as unknown as typeof profile);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to save';
      setError(msg);
      logger.error('Profile save', e);
    } finally {
      setSaving(false);
    }
  };

  if (!profile || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Profile</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-brand-600 font-medium hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-brand-100 flex items-center justify-center text-4xl">
            {profile.role === 'driver' ? '🚗' : '🧑'}
          </div>
          <p className="mt-2 text-lg font-bold text-gray-900">{profile.name}</p>
          <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
          <div className="mt-1 flex items-center gap-1 text-sm text-yellow-600">
            <span>⭐</span>
            <span>{profile.rating.toFixed(1)}</span>
            <span className="text-gray-400">· {profile.totalRides} rides</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            Profile saved!
          </div>
        )}

        <div className="space-y-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Full Name</label>
            {editing ? (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            ) : (
              <p className="text-sm text-gray-800">{profile.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Phone</label>
            {editing ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            ) : (
              <p className="text-sm text-gray-800">{profile.phone}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Email</label>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>

          {profile.role === 'driver' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Vehicle</label>
                {editing ? (
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder="e.g. Toyota Vitz"
                  />
                ) : (
                  <p className="text-sm text-gray-800">{profile.vehicleType ?? '—'}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">License Plate</label>
                {editing ? (
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder="e.g. ABC 1234"
                  />
                ) : (
                  <p className="text-sm text-gray-800">{profile.licensePlate ?? '—'}</p>
                )}
              </div>
            </>
          )}
        </div>

        {editing && (
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? <LoadingSpinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
