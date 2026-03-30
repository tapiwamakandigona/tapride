import { useState } from 'react';
import { usePromo } from '../../hooks/usePromo';
import { formatFare } from '../../lib/fare';

interface PromoCodeInputProps {
  fareEstimate: number;
}

export default function PromoCodeInput({ fareEstimate }: PromoCodeInputProps) {
  const { appliedPromo, discount, loading, validatePromo, clearPromo } = usePromo();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleApply = async () => {
    setError('');
    const result = await validatePromo(code, fareEstimate);
    if (!result.valid) {
      setError(result.error || 'Invalid code');
    }
  };

  if (appliedPromo) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            🏷 {appliedPromo.code} applied
          </p>
          <p className="text-xs text-green-600 dark:text-green-500">
            -{formatFare(discount)} discount
          </p>
        </div>
        <button
          onClick={clearPromo}
          className="text-xs text-red-500 font-semibold hover:underline"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Promo code"
          className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
        <button
          onClick={handleApply}
          disabled={!code.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-semibold transition-colors"
        >
          {loading ? '...' : 'Apply'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
