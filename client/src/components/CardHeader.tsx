import { useState } from 'react';
import type { CreditCard, Benefit } from '../types';
import { api } from '../api/client';

interface CardHeaderProps {
  card: CreditCard;
  stats?: {
    totalValue: number;
    usedValue: number;
    completedCount: number;
    pendingCount: number;
    missedCount: number;
  };
  allBenefits: Benefit[];
  onUpdateBenefit: (id: string, data: { ignored: boolean }) => void;
}

export function CardHeader({ card, stats, allBenefits, onUpdateBenefit }: CardHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const percentUsed = stats 
    ? Math.min((stats.usedValue / stats.totalValue) * 100, 100) 
    : 0;

  const ignoredCount = allBenefits.filter(b => b.ignored).length;

  const handleToggle = async (benefit: Benefit) => {
    setLoading(benefit.id);
    setError(null);
    try {
      const updated = await api.updateBenefit(benefit.id, { ignored: !benefit.ignored });
      onUpdateBenefit(benefit.id, { ignored: updated.ignored });
    } catch (err) {
      setError(`Failed to update: ${(err as Error).message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div 
      className="rounded-lg p-6 mb-6 relative"
      style={{ backgroundColor: `${card.color}20`, borderLeft: `4px solid ${card.color}` }}
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{card.name}</h2>
          <p className="text-slate-400">${card.annualFee}/year annual fee</p>
        </div>
        <div className="flex items-center gap-4">
          {ignoredCount > 0 && (
            <span className="text-xs text-amber-400">
              {ignoredCount} ignored
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
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
                    className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto"
                    role="menu"
                  >
                  <div className="p-2">
                    <p className="text-xs text-slate-500 px-2 py-1">Toggle benefits visibility</p>
                    {error && (
                      <p className="text-xs text-red-400 px-2 py-1">{error}</p>
                    )}
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
                          disabled={loading === benefit.id}
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
            <span className="text-emerald-400">✓ {stats.completedCount} completed</span>
            <span className="text-amber-400">◐ {stats.pendingCount} pending</span>
            <span className="text-red-400">✗ {stats.missedCount} missed</span>
          </div>
        </div>
      )}
    </div>
  );
}
