import { useMemo, memo } from 'react';
import type { Benefit } from '@lib/types';
import { ProgressBar } from './ProgressBar';
import { Tooltip } from './Tooltip';
import { useBenefits } from '../context/BenefitsContext';
import { buildProgressSegments, formatDate } from '@lib/utils';

const StatusBadge = ({ status }: { status: 'pending' | 'completed' | 'missed' }) => (
  <span className={`badge-status-${status} capitalize`}>{status}</span>
);

interface BenefitCardProps {
  benefit: Benefit;
  onToggleEnrollment?: (id: string) => void;
}

function BenefitCardComponent({ benefit, onToggleEnrollment }: BenefitCardProps) {
  const { selectedYear } = useBenefits();

  // Use pre-computed values from benefit object
  const segments = useMemo(() => buildProgressSegments(benefit), [benefit]);
  const segmentsCount = benefit.periods?.length ?? 1;

  const currentYear = new Date().getFullYear();
  const isCurrentYear = selectedYear === currentYear;

  const enrollmentClass = benefit.enrollmentRequired
    ? (benefit.enrolled ? 'border-l-emerald-500' : 'border-l-red-400')
    : 'border-l-emerald-500';

  return (
    <div className={`benefit-card ${enrollmentClass}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-lg">{benefit.name}</h3>
          <p className="text-slate-400 text-sm">{benefit.shortDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          {benefit.enrollmentRequired && isCurrentYear ? (
            benefit.autoEnrolledAt ? (
              // Auto-enrolled: non-clickable badge with tooltip
              <Tooltip
                content={`Enrolled due to credit on ${formatDate(benefit.autoEnrolledAt)}`}
                inline
              >
                <span className="badge-enrolled cursor-default">Enrolled</span>
              </Tooltip>
            ) : (
              // Manual enrollment: clickable toggle
              <button
                onClick={() => onToggleEnrollment?.(benefit.id)}
                className={`${benefit.enrolled ? 'badge-enrolled' : 'badge-needs-enrollment'} transition-colors hover:opacity-80`}
              >
                {benefit.enrolled ? 'Enrolled' : 'Needs Enrollment'}
              </button>
            )
          ) : null}
          <StatusBadge status={benefit.status} />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-slate-300">
            ${benefit.currentUsed.toFixed(0)} / ${benefit.creditAmount}
          </span>
        </div>
        <ProgressBar segments={segments} segmentsCount={segmentsCount} />
      </div>
    </div>
  );
}

export const BenefitCard = memo(BenefitCardComponent);
