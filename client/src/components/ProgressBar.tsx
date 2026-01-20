import { memo, type ReactNode } from 'react';
import type { ProgressSegment } from '@shared/types';
import { formatDate } from '@shared/utils';
import { Tooltip } from './Tooltip';

interface ProgressBarProps {
  segments: ProgressSegment[];
  segmentsCount: number;
}

const segmentClass = (segment: ProgressSegment) => {
  if (segment.status === 'completed') return 'progress-segment completed';
  if (segment.status === 'missed') return 'progress-segment missed';
  // pending status: yellow if current, gray if future
  if (segment.isCurrent) return 'progress-segment current';
  return 'progress-segment pending';
};

const buildTooltipContent = (segment: ProgressSegment): ReactNode => {
  const dateLabel = segment.label || 'Unknown period';
  const transactions = segment.transactions ?? [];
  const usedAmount = segment.usedAmount ?? 0;
  const segmentValue = segment.segmentValue ?? 0;
  // For multi-year benefits (e.g., 4-year Global Entry), include year in transaction dates
  const includeYear = segment.isMultiYear ?? false;

  if (transactions.length === 0) {
    return (
      <div>
        <div className="font-medium">{dateLabel}</div>
        <div className="text-slate-400 text-[10px] mt-1">No transactions</div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-medium">{dateLabel}</div>
      <div className="border-t border-slate-600 my-1" />
      {transactions.map((tx, i) => (
        <div key={i} className="flex justify-between gap-4 text-[10px]">
          <span className="text-slate-300">{formatDate(tx.date, { includeYear })} {tx.description}</span>
          <span className="text-emerald-300">${tx.amount.toFixed(2)}</span>
        </div>
      ))}
      <div className="border-t border-slate-600 my-1" />
      <div className="flex justify-between gap-4 text-[10px] font-medium">
        <span>Total</span>
        <span>${usedAmount.toFixed(2)} / ${segmentValue.toFixed(0)}</span>
      </div>
    </div>
  );
};

function ProgressBarComponent({ segments, segmentsCount }: ProgressBarProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: segmentsCount }).map((_, index) => {
        const segment = segments[index];
        return (
          <div
            key={index}
            className={`flex-1 relative ${segment ? segmentClass(segment) : 'bg-slate-700'}`}
          >
            <Tooltip content={segment ? buildTooltipContent(segment) : `Segment ${index + 1}`}>
              <div className="w-full h-full" />
            </Tooltip>
            {segment && segment.isCurrent && segment.timeProgress !== undefined && segment.daysLeft !== undefined ? (
              <div
                className="absolute -top-1 -bottom-1 w-1 bg-white border border-slate-800 rounded-sm"
                style={{ left: `${segment.timeProgress}%` }}
              >
                <Tooltip
                  content={
                    <div>
                      <div>{Math.round(segment.timeProgress)}% complete</div>
                      <div>{segment.daysLeft} days left</div>
                    </div>
                  }
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3" />
                </Tooltip>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const ProgressBar = memo(ProgressBarComponent);
