import { Benefit } from '../types';
import { ProgressBar } from './ProgressBar';
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
}

export function BenefitCard({ benefit, onEdit }: BenefitCardProps) {
  const daysUntilExpiry = getDaysUntilExpiry(benefit.endDate);
  const overallTimeProgress = getTimeProgress(benefit.startDate, benefit.endDate);

  const segmentsCount = () => {
    if (benefit.periods && benefit.periods.length > 0) {
      return benefit.periods.length;
    }
    return 1;
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

    return [
      {
        id: 'overall',
        status: benefit.status,
        label: `${formatDate(benefit.startDate)} - ${formatDate(benefit.endDate)}`,
        timeProgress: benefit.status === 'pending' ? overallTimeProgress : undefined,
        startDate: benefit.startDate,
        endDate: benefit.endDate,
        daysLeft: benefit.status === 'pending' ? daysUntilExpiry : undefined
      }
    ];
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
        <ProgressBar segments={getSegments()} segmentsCount={segmentsCount()} />
      </div>

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
            <span
              className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded border leading-tight ${
                benefit.activationAcknowledged
                  ? 'border-emerald-400/50 text-emerald-400 bg-emerald-500/10'
                  : 'border-amber-400/60 text-amber-400 bg-amber-400/10'
              }`}
            >
              {benefit.activationAcknowledged ? 'Activated' : 'Needs Activation'}
            </span>
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
