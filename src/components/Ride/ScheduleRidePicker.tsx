import { useState } from 'react';

interface ScheduleRidePickerProps {
  onSchedule: (date: Date) => void;
  onCancel: () => void;
}

export default function ScheduleRidePicker({ onSchedule, onCancel }: ScheduleRidePickerProps) {
  const now = new Date();
  const minDate = new Date(now.getTime() + 30 * 60000); // at least 30 min ahead
  const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60000); // 7 days

  const toLocalDatetime = (d: Date) => {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const [datetime, setDatetime] = useState(toLocalDatetime(minDate));
  const [error, setError] = useState('');

  const handleConfirm = () => {
    const selected = new Date(datetime);
    if (selected < minDate) {
      setError('Please select a time at least 30 minutes from now');
      return;
    }
    if (selected > maxDate) {
      setError('You can only schedule rides up to 7 days ahead');
      return;
    }
    setError('');
    onSchedule(selected);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Schedule Ride</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Choose when you'd like to be picked up
        </p>

        <input
          type="datetime-local"
          value={datetime}
          min={toLocalDatetime(minDate)}
          max={toLocalDatetime(maxDate)}
          onChange={(e) => setDatetime(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none mb-4"
        />

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
