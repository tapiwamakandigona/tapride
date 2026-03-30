import type { VerificationStatus } from '../../types';

interface VerificationBadgeProps {
  status: VerificationStatus;
  size?: 'sm' | 'md';
}

const CONFIG: Record<VerificationStatus, { label: string; style: string; icon: string }> = {
  unverified: {
    label: 'Unverified',
    style: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    icon: '○',
  },
  pending: {
    label: 'Pending Review',
    style: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: '◷',
  },
  verified: {
    label: 'Verified',
    style: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: '✓',
  },
  rejected: {
    label: 'Rejected',
    style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: '✕',
  },
};

export default function VerificationBadge({ status, size = 'sm' }: VerificationBadgeProps) {
  const { label, style, icon } = CONFIG[status] || CONFIG.unverified;
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${style} ${sizeClass}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}
