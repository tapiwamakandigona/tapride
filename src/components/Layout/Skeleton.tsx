export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded animate-shimmer ${className}`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}

export function SkeletonCircle({ size = 'w-10 h-10' }: { size?: string }) {
  return (
    <div
      className={`${size} bg-gray-200 dark:bg-gray-700 rounded-full animate-shimmer`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}

export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
