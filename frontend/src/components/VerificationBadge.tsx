import type { VerificationStatus } from '../api/types';
import { AlertIcon, CheckIcon, CrossIcon } from './icons';

const STYLES: Record<
  VerificationStatus,
  { label: string; className: string; Icon: typeof CheckIcon | null }
> = {
  verified: {
    label: 'VERIFIED',
    className: 'bg-success-container text-on-primary-container',
    Icon: CheckIcon,
  },
  flagged_review: {
    label: 'IN REVIEW',
    className: 'bg-tertiary-fixed text-on-tertiary-container',
    Icon: AlertIcon,
  },
  rejected: {
    label: 'NOT VERIFIED',
    className: 'bg-error-container text-on-error-container',
    Icon: CrossIcon,
  },
  unverified: { label: 'GPS LOST', className: 'bg-surface-c text-outline', Icon: null },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span className={`flex h-[19px] items-center gap-1 rounded-[5px] px-[7px] ${className}`}>
      {Icon && <Icon size={10} />}
      <span className="font-label text-[9px] font-bold">{label}</span>
    </span>
  );
}
