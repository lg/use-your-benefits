import { useState, useEffect, useRef, type MouseEvent, type KeyboardEvent } from 'react';
import type { Benefit } from '../types';

interface EditModalProps {
  benefit: Benefit | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: { notes: string; ignored?: boolean; activationAcknowledged?: boolean; periods?: Record<string, number> }) => void;
}

export function EditModal({ benefit, isOpen, onClose, onSave }: EditModalProps) {
  const [notes, setNotes] = useState('');
  const [ignored, setIgnored] = useState(false);
  const [activationAcknowledged, setActivationAcknowledged] = useState(false);
  const [periodUsed, setPeriodUsed] = useState<Record<string, string>>({});
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const periodTabsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (benefit) {
      setNotes(benefit.notes);
      setIgnored(benefit.ignored);
      setActivationAcknowledged(benefit.activationAcknowledged);
      const nextPeriodUsed = benefit.periods?.reduce<Record<string, string>>((acc, period) => {
        acc[period.id] = period.usedAmount.toString();
        return acc;
      }, {});
      setPeriodUsed(nextPeriodUsed ?? {});

      const now = new Date();
      const visiblePeriods = (benefit.periods ?? [])
        .filter(period => new Date(period.startDate) <= now)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const currentPeriod = visiblePeriods.find(period => {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        return now >= start && now <= end;
      });
      setSelectedPeriodId(currentPeriod?.id ?? visiblePeriods[0]?.id ?? '');
      if (periodTabsRef.current) {
        periodTabsRef.current.scrollLeft = periodTabsRef.current.scrollWidth;
      }
    }
  }, [benefit]);

  if (!isOpen || !benefit) return null;

  const notesInputId = `benefit-notes-${benefit.id}`;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  const handleSave = () => {
    const periodUpdates = Object.entries(periodUsed).reduce<Record<string, number>>((acc, [periodId, value]) => {
      acc[periodId] = parseFloat(value) || 0;
      return acc;
    }, {});

    onSave(benefit.id, {
      notes,
      ignored,
      activationAcknowledged: benefit.activationRequired ? activationAcknowledged : undefined,
      periods: Object.keys(periodUpdates).length ? periodUpdates : undefined
    });
    onClose();
  };

  const periodValue = benefit.periods?.length
    ? benefit.creditAmount / benefit.periods.length
    : benefit.creditAmount;

  const now = new Date();
  const periodEntries = benefit.periods ?? [];
  const visiblePeriods = periodEntries
    .filter(period => new Date(period.startDate) <= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const selectedPeriod = visiblePeriods.find(period => period.id === selectedPeriodId) ?? visiblePeriods[0];
  const selectedPeriodIdValue = selectedPeriod?.id ?? '';

  const formatPeriodLabel = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="presentation"
      tabIndex={0}
    >
      <div className="modal-content" role="dialog" aria-modal="true">
        <h2 className="text-xl font-bold mb-4">Edit {benefit.name}</h2>
        
        {visiblePeriods.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-slate-400 mb-2">Segment Spend</div>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <div className="text-sm text-slate-400">Period</div>
                <div
                  ref={periodTabsRef}
                  className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                >
                  {visiblePeriods.map(period => {
                    const isSelected = period.id === selectedPeriodIdValue;
                    const usedValue = parseFloat(periodUsed[period.id] ?? '0') || 0;
                    const isComplete = usedValue >= periodValue;
                    const endDate = new Date(period.endDate);
                    const isPast = now > endDate;
                    const borderClass = isComplete
                      ? 'border-emerald-400'
                      : isPast
                        ? 'border-red-400'
                        : 'border-amber-400';
                    const spentTextClass = isComplete
                      ? 'text-emerald-300'
                      : isPast
                        ? 'text-red-300'
                        : 'text-amber-300';

                    return (
                      <button
                        key={period.id}
                        type="button"
                        onClick={() => setSelectedPeriodId(period.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${borderClass} ${
                          isSelected
                            ? 'bg-slate-200 text-slate-900'
                            : 'bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span>{formatPeriodLabel(period.startDate, period.endDate)}</span>
                          <span className={isSelected ? 'text-slate-700' : spentTextClass}>
                            ${usedValue.toFixed(0)} of ${periodValue.toFixed(0)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedPeriod && (
                <div className="grid gap-2 pl-4 border-l border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      className="text-sm text-slate-400"
                      htmlFor={`period-used-${benefit.id}-${selectedPeriod.id}`}
                    >
                      Spent ({formatPeriodLabel(selectedPeriod.startDate, selectedPeriod.endDate)})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`period-used-${benefit.id}-${selectedPeriod.id}`}
                        type="number"
                        value={periodUsed[selectedPeriod.id] ?? ''}
                        onChange={e =>
                          setPeriodUsed(prev => ({
                            ...prev,
                            [selectedPeriod.id]: e.target.value
                          }))
                        }
                        className="input-field max-w-[160px]"
                        min="0"
                        max={periodValue}
                        step="0.01"
                      />
                      <span className="text-sm text-slate-500 whitespace-nowrap">of ${periodValue.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1" htmlFor={notesInputId}>
            Notes
          </label>
          <textarea
            id={notesInputId}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input-field h-24 resize-none"
            placeholder="How did you use this benefit?"
          />
        </div>

        {benefit.activationRequired && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activationAcknowledged}
                onChange={() => setActivationAcknowledged(!activationAcknowledged)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm">Enrolled/activated benefit</span>
            </label>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!ignored}
              onChange={() => setIgnored(!ignored)}
              className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm">Show in list (uncheck to hide)</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
