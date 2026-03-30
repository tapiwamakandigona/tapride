import { useNavigate } from 'react-router-dom';

interface RetryErrorProps {
  message?: string;
  onRetry?: () => void;
  showHome?: boolean;
}

export default function RetryError({
  message = 'Something went wrong',
  onRetry,
  showHome = true,
}: RetryErrorProps) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-red-500 dark:text-red-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          {message}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Check your connection and try again.
        </p>
        <div className="space-y-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
            >
              Retry
            </button>
          )}
          {showHome && (
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
