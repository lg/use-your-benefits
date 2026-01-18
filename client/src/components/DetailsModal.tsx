import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo, memo, type MouseEvent, type KeyboardEvent } from 'react';
import type { Benefit } from '../types';
import type { StoredTransaction } from '../../../shared/types';
import { buildBenefitUsageSnapshot } from '../utils/dateUtils';

interface DetailsModalProps {
  benefit: Benefit | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleEnrollment: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  initialPeriodId?: string;
}

function DetailsModalComponent({ benefit, isOpen, onClose, onToggleEnrollment, onToggleVisibility, initialPeriodId }: DetailsModalProps) {
  const periodTabsRef = useRef<HTMLDivElement>(null);
  const [targetPeriodId, setTargetPeriodId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const now = new Date();

  const snapshot = useMemo(() => {
    if (!benefit) return null;
    return buildBenefitUsageSnapshot(benefit, benefit, undefined);
  }, [benefit]);

  const displayPeriods = useMemo(() => {
    if (!snapshot?.periods) return [];
    return snapshot.periods
      .filter(period => new Date(period.startDate) <= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [snapshot?.periods]);

  useEffect(() => {
    if (!benefit || !snapshot) return;
    const periodId = initialPeriodId && displayPeriods.some(p => p.id === initialPeriodId)
      ? initialPeriodId
      : displayPeriods.find(period => {
          const start = new Date(period.startDate);
          const end = new Date(period.endDate);
          return now >= start && now <= end;
        })?.id ?? displayPeriods[0]?.id ?? '';

    setSelectedPeriodId(periodId);
    setTargetPeriodId(periodId);
  }, [benefit, initialPeriodId, displayPeriods, snapshot]);

  const handlePeriodClick = useCallback((periodId: string) => {
    setSelectedPeriodId(periodId);
  }, []);

  useLayoutEffect(() => {
    if (!periodTabsRef.current || !targetPeriodId || displayPeriods.length === 0) return;
    const container = periodTabsRef.current;
    container.scrollLeft = container.scrollWidth;
  }, [targetPeriodId, displayPeriods, isOpen]);

  useEffect(() => {
    if (!periodTabsRef.current || !targetPeriodId || displayPeriods.length === 0) return;
    const container = periodTabsRef.current;
    const targetIndex = displayPeriods.findIndex((p: { id: string }) => p.id === targetPeriodId);
    if (targetIndex >= 0) {
      const timer = setTimeout(() => {
        const tabElements = container.querySelectorAll('button');
        const targetTab = tabElements[targetIndex] as HTMLElement;
        if (targetTab) {
          targetTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [targetPeriodId, displayPeriods, isOpen]);

  if (!isOpen || !benefit || !snapshot) return null;

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

  const periodValue = snapshot.periods.length > 0
    ? benefit.creditAmount / snapshot.periods.length
    : benefit.creditAmount;

  const selectedPeriod = displayPeriods.find(period => period.id === selectedPeriodId) ?? displayPeriods[0];
  const selectedPeriodIdValue = selectedPeriod?.id ?? '';

  const formatPeriodLabel = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `${startLabel} – ${endLabel}`;
  };

  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const getPeriodTransactions = (): StoredTransaction[] => {
    if (selectedPeriodId && snapshot.periods) {
      const period = snapshot.periods.find(p => p.id === selectedPeriodId);
      return period?.transactions ?? [];
    }
    return snapshot.yearTransactions;
  };

  const getPeriodUsedAmount = (): number => {
    if (selectedPeriodId && snapshot.periods) {
      const period = snapshot.periods.find(p => p.id === selectedPeriodId);
      return period?.usedAmount ?? 0;
    }
    return snapshot.currentUsed;
  };

  const transactions = getPeriodTransactions();
  const usedAmount = getPeriodUsedAmount();

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="presentation"
      tabIndex={0}
    >
      <div className="modal-content" role="dialog" aria-modal="true">
        <div className="mb-4">
          <h2 className="text-xl font-bold">{benefit.name}</h2>
          {benefit.claimedElsewhereYear ? (
            <p className="text-sm text-emerald-300 mt-1">
              Claimed in {benefit.claimedElsewhereYear}
            </p>
          ) : null}
        </div>

        {displayPeriods.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-slate-400 mb-2">Segment Transactions</div>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <div className="text-sm text-slate-400">Period</div>
                <div
                  ref={periodTabsRef}
                  className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                >
                  {displayPeriods.map(period => {
                    const isSelected = period.id === selectedPeriodIdValue;
                    const periodUsed = period.usedAmount;
                    const isComplete = period.status === 'completed';
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
                        onClick={() => handlePeriodClick(period.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${borderClass} ${
                          isSelected
                            ? 'bg-slate-200 text-slate-900'
                            : 'bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span>{formatPeriodLabel(period.startDate, period.endDate)}</span>
                          <span className={isSelected ? 'text-slate-700' : spentTextClass}>
                            ${periodUsed.toFixed(0)} of ${periodValue.toFixed(0)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedPeriod && (
                <div className="grid gap-2 pl-4 border-l border-slate-700">
                  <div className="text-sm text-slate-400">
                    Transactions ({formatPeriodLabel(selectedPeriod.startDate, selectedPeriod.endDate)})
                  </div>
                  {transactions.length > 0 ? (
                    <div className="space-y-1">
                  {transactions.map((tx) => (
                    <div key={`${tx.date}-${tx.description}-${tx.amount}`} className="flex justify-between text-sm py-1">
                          <span className="text-slate-300">
                            {formatDateLabel(tx.date)} {tx.description}
                          </span>
                          <span className="text-emerald-300">${tx.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm py-2 border-t border-slate-700 font-medium">
                        <span className="text-slate-300">Total</span>
                        <span className="text-slate-100">${usedAmount.toFixed(2)} of ${periodValue.toFixed(0)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 italic">
                      No transactions imported yet. Import your statement to track usage.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {displayPeriods.length === 0 && (
          <div className="mb-4">
            <div className="text-sm text-slate-400 mb-2">Transactions</div>
            {transactions.length > 0 ? (
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <div key={`${tx.date}-${tx.description}-${tx.amount}`} className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">
                      {formatDateLabel(tx.date)} {tx.description}
                    </span>
                    <span className="text-emerald-300">${tx.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-700 font-medium">
                  <span className="text-slate-300">Total</span>
                  <span className="text-slate-100">${usedAmount.toFixed(2)} of ${benefit.creditAmount}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">
                No transactions imported yet. Import your statement to track usage.
              </div>
            )}
          </div>
        )}

        {benefit.enrollmentRequired && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={benefit.enrolled}
                onChange={() => onToggleEnrollment(benefit.id)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm">Enrolled in benefit</span>
            </label>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!benefit.ignored}
              onChange={() => onToggleVisibility(benefit.id)}
              className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm">Show in list (uncheck to hide)</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary" type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export const DetailsModal = memo(DetailsModalComponent);
