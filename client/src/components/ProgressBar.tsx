import type { ProgressSegment } from '../types';
import { Tooltip } from './Tooltip';

interface ProgressBarProps {
  segments: ProgressSegment[];
  segmentsCount: number;
}

export function ProgressBar({ segments, segmentsCount }: ProgressBarProps) {
  const segmentClass = (status: ProgressSegment['status']) => {
    switch (status) {
      case 'completed':
        return 'progress-segment completed';
      case 'missed':
        return 'progress-segment missed';
      case 'future':
        return 'progress-segment future';
      default:
        return 'progress-segment pending';
    }
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: segmentsCount }).map((_, index) => {
        const segment = segments[index];
        return (
          <div
            key={index}
            className={`flex-1 relative ${segment ? segmentClass(segment.status) : 'bg-slate-700'}`}
          >
            <Tooltip content={segment?.label || `Segment ${index + 1}`}>
              <div className="w-full h-full" />
            </Tooltip>
            {segment && segment.isCurrent && segment.timeProgress !== undefined && segment.daysLeft !== undefined && (
              <div
                className="absolute -top-1 -bottom-1 w-1 bg-white border border-slate-800 rounded-sm z-10"
                style={{ left: `${segment.timeProgress}%` }}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3">
                  <Tooltip
                    content={
                      <div>
                        <div>{Math.round(segment.timeProgress)}% complete</div>
                        <div>{segment.daysLeft} days left</div>
                      </div>
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
