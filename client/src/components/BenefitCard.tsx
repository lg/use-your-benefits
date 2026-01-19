import { useMemo, memo } from 'react';
import type { Benefit } from '@shared/types';
import { ProgressBar } from './ProgressBar';
import { Tooltip } from './Tooltip';
import { useBenefits } from '../context/BenefitsContext';
import { buildBenefitUsageSnapshot, buildProgressSegments, formatDate } from '../utils/dateUtils';

interface StatusBadgeProps {
  status: 'pending' | 'completed' | 'missed';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    pending: 'bg-amber-400 text-slate-900',
    completed: 'bg-emerald-500 text-white',
    missed: 'bg-red-500 text-white',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

interface BenefitCardProps {
  benefit: Benefit;
  onToggleEnrollment?: (id: string) => void;
}

function BenefitCardComponent({ benefit, onToggleEnrollment }: BenefitCardProps) {
  const { selectedYear } = useBenefits();

  const snapshot = useMemo(() => 
    buildBenefitUsageSnapshot(benefit, benefit, selectedYear),
    [benefit, selectedYear]
  );

  const segments = useMemo(() => 
    buildProgressSegments(benefit, snapshot),
    [benefit, snapshot]
  );

  const segmentsCount = useMemo(() => 
    snapshot.periods.length > 0 ? snapshot.periods.length : 1,
    [snapshot.periods]
  );

  const daysUntilExpiry = useMemo(() => {
    const expiry = new Date(benefit.endDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [benefit.endDate]);

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
          <StatusBadge status={snapshot.status} />
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-slate-300">
            ${snapshot.currentUsed.toFixed(0)} / ${benefit.creditAmount}
          </span>
        </div>
        <ProgressBar segments={segments} segmentsCount={segmentsCount} />
      </div>

      <div className="flex justify-between items-center text-sm">
        <div className="text-slate-500">
          Expires: {formatDate(benefit.endDate)}
          {daysUntilExpiry > 0 && daysUntilExpiry <= 30 ? (
            <span className="text-amber-400 ml-1">
              ({daysUntilExpiry} days left)
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {benefit.enrollmentRequired && isCurrentYear ? (
            benefit.autoEnrolledAt ? (
              // Auto-enrolled: non-clickable badge with tooltip
              <Tooltip
                content={`Enrolled due to credit on ${formatDate(benefit.autoEnrolledAt)}`}
                inline
              >
                <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded border leading-tight border-emerald-400/50 text-emerald-400 bg-emerald-500/10 cursor-default">
                  Enrolled
                </span>
              </Tooltip>
            ) : (
              // Manual enrollment: clickable toggle
              <button
                onClick={() => onToggleEnrollment?.(benefit.id)}
                className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded border leading-tight transition-colors hover:opacity-80 ${
                  benefit.enrolled
                    ? 'border-emerald-400/50 text-emerald-400 bg-emerald-500/10'
                    : 'border-red-400/60 text-red-400 bg-red-400/10'
                }`}
              >
                {benefit.enrolled ? 'Enrolled' : 'Needs Enrollment'}
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const BenefitCard = memo(BenefitCardComponent);
