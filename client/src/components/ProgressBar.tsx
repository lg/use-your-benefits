interface ProgressSegment {
  id: string;
  status: 'pending' | 'completed' | 'missed';
  label?: string;
  timeProgress?: number;
}

interface ProgressBarProps {
  segments: ProgressSegment[];
  segmentsCount: number;
}

export function ProgressBar({ segments, segmentsCount }: ProgressBarProps) {
  const segmentClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'progress-segment completed';
      case 'missed':
        return 'progress-segment missed';
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
            title={segment?.label || `Segment ${index + 1}`}
          >
            {segment && segment.timeProgress !== undefined && segment.status === 'pending' && (
              <div
                className="absolute -top-1 -bottom-1 w-1 bg-white border border-slate-800 rounded-sm z-10"
                style={{ left: `${segment.timeProgress}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
