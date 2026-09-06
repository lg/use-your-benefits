import { useMemo, memo } from 'react';
import type { Benefit, BenefitStatus } from '@lib/types';
import { ProgressBar } from './ProgressBar';
import { Tooltip } from './Tooltip';
import { useBenefits } from '../context/BenefitsContext';
import { buildProgressSegments, formatDate } from '@lib/utils';

const StatusBadge = ({ status }: { status: BenefitStatus }) => (
  <span className={`badge-status-${status} capitalize`}>{status}</span>
);

interface BenefitCardProps {
  benefit: Benefit;
  onToggleEnrollment?: (id: string) => void;
}

function BenefitCardComponent({ benefit, onToggleEnrollment }: BenefitCardProps) {
  const { selectedYear, onAnnualResetDateChange } = useBenefits();

  // Use pre-computed values from benefit object
  const segments = useMemo(() => buildProgressSegments(benefit), [benefit]);
  const segmentsCount = benefit.periods?.length ?? 1;

  const currentYear = new Date().getUTCFullYear();
  const isCurrentYear = selectedYear === currentYear;
  const footerNote = benefit.excludeFromTotals ? 'Excluded from all calculations'
    : isCurrentYear && benefit.availableNow === null ? benefit.availabilityNote
    : benefit.claimedElsewhereYear ? `Credit received in ${benefit.claimedElsewhereYear}` : undefined;

  const enrollmentClass = benefit.status === 'unavailable' ? 'border-l-slate-600' : benefit.enrollmentRequired
    ? (benefit.enrolled ? 'border-l-emerald-500' : 'border-l-red-400')
    : 'border-l-emerald-500';

  return (
    <div className={`benefit-card grid grid-rows-subgrid row-span-3 mb-4 ${enrollmentClass}`}>
      <div className="benefit-card-header grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 mb-2">
        <h3 className="font-semibold text-lg break-words">
          {benefit.inferredAirline ? (
            <Tooltip inline content={`Airline inferred from ${benefit.inferredAirline.creditCount} airline-fee credit(s) in ${selectedYear}. Latest credit: ${formatDate(benefit.inferredAirline.latestCreditDate)}. Uses airline names in credits or same-amount airline charges within the preceding 14 days. This does not confirm the current selection in your Amex account.`}>
              <span>{benefit.name} ({benefit.inferredAirline.name})</span>
            </Tooltip>
          ) : benefit.name}
        </h3>
        <div className="benefit-card-badges flex items-center justify-end gap-2 whitespace-nowrap">
          {benefit.enrollmentRequired && isCurrentYear && benefit.status !== 'unavailable' ? (
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
          {benefit.excludeFromTotals ? <span className="badge-status-unavailable">Excluded</span> : <StatusBadge status={benefit.status} />}
        </div>
        <p className="col-span-2 text-slate-400 text-sm">{benefit.shortDescription}</p>
      </div>

      <div>
        <div className="flex justify-between text-sm min-h-5 mb-1" aria-hidden={benefit.excludeFromTotals || undefined}>
          {!benefit.excludeFromTotals && <>
          <span className="text-slate-400">Credits in {selectedYear}</span>
          <span className="text-slate-300">
            ${benefit.currentUsed.toFixed(0)} / ${benefit.creditAmount}
          </span>
          </>}
        </div>
        <ProgressBar
          segments={segments}
          segmentsCount={segmentsCount}
          isUnsupported={Boolean(benefit.unsupported)}
        />
      </div>
      <div>
        {footerNote && <p className="text-xs text-slate-400 mt-2">{footerNote}</p>}
        {benefit.resetBasis === 'anniversary' && (
          <label className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400">
            Travel credit reset date
            <input
              type="date"
              value={benefit.annualResetDate ?? ''}
              onChange={event => onAnnualResetDateChange(benefit.id, event.target.value)}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200 [color-scheme:dark]"
              title="Use the reset date shown on your Chase benefits page."
            />
          </label>
        )}
      </div>
    </div>
  );
}

export const BenefitCard = memo(BenefitCardComponent);
