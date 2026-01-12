import { Benefit } from '../types';
import { ProgressBar } from './ProgressBar';
import { Tooltip } from './Tooltip';
import { formatDate, getDaysUntilExpiry, getTimeProgress } from '../utils/dateUtils';

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
  onEdit: (benefit: Benefit) => void;
  onToggleActivation: (id: string) => void;
}

export function BenefitCard({ benefit, onEdit, onToggleActivation }: BenefitCardProps) {
  const daysUntilExpiry = getDaysUntilExpiry(benefit.endDate);
  const progressPercent = Math.min((benefit.currentUsed / benefit.creditAmount) * 100, 100);
  const overallTimeProgress = getTimeProgress(benefit.startDate, benefit.endDate);

  const segmentsCount = () => {
    if (benefit.periods && benefit.periods.length > 0) {
      return benefit.periods.length;
    }
    switch (benefit.resetFrequency) {
      case 'quarterly':
        return 4;
      case 'twice-yearly':
        return 2;
      case 'annual':
        return 1;
      default:
        return 1;
    }
  };

  const getCurrentPeriodIndex = (): number => {
    if (!benefit.periods || benefit.periods.length === 0) {
      return -1;
    }
    const now = new Date();
    return benefit.periods.findIndex(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return now >= start && now <= end;
    });
  };

  interface ProgressSegment {
    id: string;
    status: 'pending' | 'completed' | 'missed';
    label?: string;
    timeProgress?: number;
    startDate?: string;
    endDate?: string;
    daysLeft?: number;
  }

  const getSegments = (): ProgressSegment[] => {
    if (benefit.periods && benefit.periods.length > 0) {
      const currentIndex = getCurrentPeriodIndex();
      return benefit.periods.map((p, i) => ({
        id: p.id,
        status: p.status as 'pending' | 'completed' | 'missed',
        label: `${formatDate(p.startDate)} - ${formatDate(p.endDate)}`,
        timeProgress: i === currentIndex && p.status === 'pending' ? getTimeProgress(p.startDate, p.endDate) : undefined,
        startDate: p.startDate,
        endDate: p.endDate,
        daysLeft: i === currentIndex ? getDaysUntilExpiry(p.endDate) : undefined
      }));
    }

    const count = segmentsCount();
    const segmentUsed = benefit.creditAmount / count;
    const currentSegmentIndex = Math.floor(benefit.currentUsed / segmentUsed);

    const start = new Date(benefit.startDate);
    const end = new Date(benefit.endDate);
    const totalDuration = end.getTime() - start.getTime();
    const segmentDuration = totalDuration / count;

    return Array.from({ length: count }).map((_, i): ProgressSegment => {
      const segmentStart = new Date(start.getTime() + i * segmentDuration);
      const segmentEnd = new Date(start.getTime() + (i + 1) * segmentDuration);
      const isPending = i === currentSegmentIndex && benefit.currentUsed < benefit.creditAmount;

      return {
        id: `seg-${i}`,
        status: i < currentSegmentIndex
          ? 'completed'
          : isPending
          ? 'pending'
          : 'missed',
        label: `Segment ${i + 1}`,
        timeProgress: isPending ? getTimeProgress(segmentStart.toISOString(), segmentEnd.toISOString()) : undefined,
        startDate: segmentStart.toISOString(),
        endDate: segmentEnd.toISOString(),
        daysLeft: isPending ? getDaysUntilExpiry(segmentEnd.toISOString()) : undefined
      };
    });
  };

  const activationClass = () => {
    if (!benefit.activationRequired) return 'border-l-emerald-500';
    return benefit.activationAcknowledged ? 'border-l-emerald-500' : 'border-l-amber-400';
  };

  return (
    <div className={`benefit-card ${activationClass()}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-lg">{benefit.name}</h3>
          <p className="text-slate-400 text-sm">{benefit.shortDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={benefit.status} />
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-slate-300">
            ${benefit.currentUsed.toFixed(0)} / ${benefit.creditAmount}
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 relative">
          <div
            className={`h-2 rounded-full transition-all ${
              benefit.status === 'completed' ? 'bg-emerald-500' :
              benefit.status === 'missed' ? 'bg-red-500' : 'bg-amber-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
          {benefit.status === 'pending' && (
            <div
              className="absolute -top-1 -bottom-1 w-1 bg-white border border-slate-800 rounded-sm z-10"
              style={{ left: `${overallTimeProgress}%` }}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3">
                <Tooltip
                  content={
                    <div>
                      <div>{Math.round(overallTimeProgress)}% complete</div>
                      <div>{daysUntilExpiry} days left</div>
                    </div>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {benefit.periods && benefit.periods.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Periods:</p>
          <ProgressBar segments={getSegments()} segmentsCount={segmentsCount()} />
        </div>
      )}

      <div className="flex justify-between items-center text-sm">
        <div className="text-slate-500">
          Expires: {formatDate(benefit.endDate)}
          {daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
            <span className="text-amber-400 ml-1">
              ({daysUntilExpiry} days left)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {benefit.activationRequired && (
            <button
              onClick={() => onToggleActivation(benefit.id)}
              className={`text-xs px-2 py-1 rounded ${
                benefit.activationAcknowledged
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-400/20 text-amber-400'
              }`}
            >
              {benefit.activationAcknowledged ? 'Activated' : 'Needs Activation'}
            </button>
          )}
          <button
            onClick={() => onEdit(benefit)}
            className="btn-secondary text-xs px-3 py-1"
          >
            Edit
          </button>
        </div>
      </div>

      {benefit.notes && (
        <div className="mt-2 p-2 bg-slate-900 rounded text-sm text-slate-400">
          📝 {benefit.notes}
        </div>
      )}
    </div>
  );
}
