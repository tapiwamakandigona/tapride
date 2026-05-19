/**
 * StatusBadge — displays a colour-coded ride status pill.
 */
import React from 'react';
import type { RideStatus } from '@/types';

interface Props {
  status: RideStatus;
}

const STATUS_CONFIG: Record<RideStatus, { label: string; classes: string }> = {
  pending: { label: 'Requested', classes: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Accepted', classes: 'bg-blue-100 text-blue-800' },
  inprogress: { label: 'In Progress', classes: 'bg-brand-100 text-brand-800' },
  completed: { label: 'Completed', classes: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-800' },
};

/** Renders a styled pill badge for a given ride status. */
export const StatusBadge: React.FC<Props> = ({ status }) => {
  const { label, classes } = STATUS_CONFIG[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
};
