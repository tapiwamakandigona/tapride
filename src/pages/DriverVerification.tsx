import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../lib/storage';
import { supabase } from '../lib/supabase';

type Step = 1 | 2 | 3;

export default function DriverVerification() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [licenseUrl, setLicenseUrl] = useState(
    (profile as unknown as Record<string, unknown>)?.drivers_license_url as string || ''
  );
  const [registrationUrl, setRegistrationUrl] = useState(
    (profile as unknown as Record<string, unknown>)?.vehicle_registration_url as string || ''
  );
  const [photoUrl, setPhotoUrl] = useState(
    (profile as unknown as Record<string, unknown>)?.profile_photo_url as string || ''
  );

  const handleUpload = async (file: File, folder: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    return uploadFile(file, user.id, folder);
  };

  const handleNext = async () => {
    setError('');
    setLoading(true);
    try {
      if (step === 1) {
        if (licenseFile) {
          const url = await handleUpload(licenseFile, 'license');
          setLicenseUrl(url);
        }
        if (!licenseUrl && !licenseFile) {
          setError("Please upload your driver's license");
          return;
        }
        setStep(2);
      } else if (step === 2) {
        if (registrationFile) {
          const url = await handleUpload(registrationFile, 'registration');
          setRegistrationUrl(url);
        }
        if (!registrationUrl && !registrationFile) {
          setError('Please upload your vehicle registration');
          return;
        }
        setStep(3);
      } else if (step === 3) {
        if (photoFile) {
          const url = await handleUpload(photoFile, 'photo');
          setPhotoUrl(url);
        }
        if (!photoUrl && !photoFile) {
          setError('Please upload a profile photo');
          return;
        }
        // Save all URLs and set status to pending
        await saveVerification();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const saveVerification = async () => {
    if (!user) return;

    // Get fresh URLs (photoFile may have just been uploaded)
    const finalLicense = licenseFile ? await handleUpload(licenseFile, 'license').catch(() => licenseUrl) : licenseUrl;
    const finalReg = registrationFile ? await handleUpload(registrationFile, 'registration').catch(() => registrationUrl) : registrationUrl;
    const finalPhoto = photoFile ? await handleUpload(photoFile, 'photo').catch(() => photoUrl) : photoUrl;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        drivers_license_url: finalLicense,
        vehicle_registration_url: finalReg,
        profile_photo_url: finalPhoto,
        verification_status: 'pending',
      })
      .eq('id', user.id);

    if (updateError) throw new Error(updateError.message);
    await refreshProfile();
    navigate('/driver', { replace: true });
  };

  const stepLabels = ["Driver's License", 'Vehicle Registration', 'Profile Photo'];
  const stepDescriptions = [
    'Upload a clear photo of your valid driver\'s license',
    'Upload your vehicle registration document',
    'Upload a clear photo of yourself for rider verification',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Driver Verification</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of 3</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${
                s <= step ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {stepLabels[step - 1]}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {stepDescriptions[step - 1]}
          </p>

          {/* File input */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
            {(step === 1 && (licenseFile || licenseUrl)) ||
             (step === 2 && (registrationFile || registrationUrl)) ||
             (step === 3 && (photoFile || photoUrl)) ? (
              <div>
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {step === 1 ? licenseFile?.name || 'Previously uploaded' :
                   step === 2 ? registrationFile?.name || 'Previously uploaded' :
                   photoFile?.name || 'Previously uploaded'}
                </p>
                <label className="text-sm text-primary-600 dark:text-primary-400 font-medium cursor-pointer hover:underline">
                  Change file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (step === 1) setLicenseFile(f);
                      else if (step === 2) setRegistrationFile(f);
                      else setPhotoFile(f);
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Tap to upload
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  JPG, PNG — max 5MB
                </p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (step === 1) setLicenseFile(f);
                    else if (step === 2) setRegistrationFile(f);
                    else setPhotoFile(f);
                  }}
                />
              </label>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-3">
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold transition-colors"
        >
          {loading ? 'Uploading...' : step === 3 ? 'Submit for Verification' : 'Next'}
        </button>
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as Step)}
            className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
