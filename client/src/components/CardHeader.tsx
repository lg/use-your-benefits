import { useState, useCallback, memo } from 'react';
import type { CreditCard, Benefit, CardStats } from '@shared/types';
import { getAnnualFee, formatDateRange } from '@shared/utils';

interface TransactionStatus {
  hasData: boolean;
  dateRange: { min: Date; max: Date } | null;
}

interface CardHeaderProps {
  card: CreditCard;
  stats?: CardStats;
  allBenefits: Benefit[];
  selectedYear: number;
  onUpdateBenefit: (id: string) => void;
  transactionStatus?: TransactionStatus;
  onOpenTransactions?: () => void;
}

function CardHeaderComponent({ card, stats, allBenefits, selectedYear, onUpdateBenefit, transactionStatus, onOpenTransactions }: CardHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const percentUsed = stats 
    ? Math.min((stats.usedValue / stats.totalValue) * 100, 100) 
    : 0;

  const ignoredCount = allBenefits.filter(b => b.ignored).length;

  const handleToggle = useCallback((benefit: Benefit) => {
    onUpdateBenefit(benefit.id);
  }, [onUpdateBenefit]);

  // Transaction status pill (clickable to open data manager)
  const transactionPill = (
    <button
      onClick={onOpenTransactions}
      className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
        transactionStatus?.hasData && transactionStatus.dateRange
          ? 'border border-slate-500 text-slate-400 hover:border-slate-400 hover:text-slate-300'
          : 'bg-red-500 text-white hover:bg-red-600'
      }`}
      title="Manage transaction data"
    >
      {transactionStatus?.hasData && transactionStatus.dateRange
        ? `Imported: ${formatDateRange(transactionStatus.dateRange.min, transactionStatus.dateRange.max)}`
        : 'No transaction data'}
    </button>
  );

  return (
    <div 
      className="rounded-lg p-6 mb-6 relative"
      style={{ backgroundColor: `${card.color}20`, borderLeft: `4px solid ${card.color}` }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{card.name}</h2>
            {transactionPill}
          </div>
          <p className="text-slate-400">${getAnnualFee(card, selectedYear)}/year annual fee in {selectedYear}</p>
        </div>
        <div className="flex items-center gap-2">
          {ignoredCount > 0 && (
            <span className="text-xs text-amber-400">
              {ignoredCount} ignored
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Manage benefits"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
            </button>
              {dropdownOpen && (
                <>
                   <button
                     className="fixed inset-0 z-10 bg-transparent border-0 cursor-default"
                     onClick={() => setDropdownOpen(false)}
                     onKeyDown={(e) => e.key === 'Escape' && setDropdownOpen(false)}
                     tabIndex={0}
                     aria-label="Close dropdown"
                   />
                   <div 
                     className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto scrollbar-dark"
                     role="menu"
                   >
                   <div className="p-2">
                     <p className="text-xs text-slate-500 px-2 py-1">Toggle benefits visibility</p>
                     {allBenefits.map(benefit => (
                       <label
                         key={benefit.id}
                         className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer"
                         role="menuitem"
                       >
                         <input
                           type="checkbox"
                           checked={!benefit.ignored}
                           onChange={() => handleToggle(benefit)}
                           className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                         />
                         <span className="text-sm truncate flex-1">{benefit.name}</span>
                       </label>
                     ))}
                   </div>
                 </div>
              </>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Value Used</span>
            <span className="text-slate-300">
              ${stats.usedValue.toFixed(0)} / ${stats.totalValue}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-emerald-400">
              Current: {stats.currentPeriodCompletedCount}/{stats.totalBenefits}
            </span>
            <span className="text-emerald-400">
              YTD: {stats.ytdCompletedPeriods}/{stats.ytdTotalPeriods}
            </span>
            <span className="text-slate-400">◐ {stats.pendingCount} pending</span>
            <span className="text-red-400">✗ {stats.missedCount} missed</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const CardHeader = memo(CardHeaderComponent);
