import { SkeletonLine, SkeletonCard } from '../Layout/Skeleton';

function RideCardSkeleton() {
  return (
    <SkeletonCard>
      {/* Status + date row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <SkeletonLine className="w-20 h-5" />
          <SkeletonLine className="w-16 h-5" />
        </div>
        <SkeletonLine className="w-28 h-4" />
      </div>
      {/* Addresses */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
          <SkeletonLine className="w-3/4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
          <SkeletonLine className="w-2/3 h-4" />
        </div>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <SkeletonLine className="w-16 h-4" />
        <SkeletonLine className="w-20 h-5" />
      </div>
    </SkeletonCard>
  );
}

export default function RideHistorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading ride history">
      {[1, 2, 3, 4].map((i) => (
        <RideCardSkeleton key={i} />
      ))}
    </div>
  );
}
