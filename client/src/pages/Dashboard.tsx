import { useMemo } from 'react';
import type { Benefit, Stats, CreditCard } from '@shared/types';
import { BenefitCard } from '../components/BenefitCard';
import { CardHeader } from '../components/CardHeader';
import { useBenefits } from '../context/BenefitsContext';
import { calculateStats, getTotalAnnualFee } from '@shared/utils';

interface CardTransactionStatus {
  hasData: boolean;
  dateRange: { min: Date; max: Date } | null;
}

interface DashboardProps {
  benefits: Benefit[];
  cards: CreditCard[];
  allBenefits: Benefit[];
  stats: Stats | null;
  cardTransactionStatus: Record<string, CardTransactionStatus>;
  onOpenTransactions: () => void;
}

export function Dashboard({
  benefits,
  cards,
  allBenefits,
  stats,
  cardTransactionStatus,
  onOpenTransactions,
}: DashboardProps) {
  const { selectedYear, onToggleEnrollment, onToggleVisibility } = useBenefits();

  const benefitsByCard = useMemo(() => 
    cards.map(card => ({
      card,
      benefits: benefits.filter(b => b.cardId === card.id),
      allBenefits: allBenefits.filter(b => b.cardId === card.id)
    })),
    [cards, benefits, allBenefits]
  );

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total Value</p>
            <p className="text-2xl font-bold">${stats.totalValue}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Used (${getTotalAnnualFee(cards, selectedYear)} fee)</p>
            <p className="text-2xl font-bold text-emerald-400">${stats.usedValue.toFixed(0)}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Remaining</p>
            <p className="text-2xl font-bold text-amber-400">
              ${(stats.totalValue - stats.usedValue).toFixed(0)}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Current Period</p>
            <p className="text-2xl font-bold text-emerald-400">
              {stats.currentPeriodCompletedCount}/{stats.totalBenefits}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Year-to-date</p>
            <p className="text-2xl font-bold text-emerald-400">
              {stats.ytdCompletedPeriods}/{stats.ytdTotalPeriods}
            </p>
          </div>
        </div>
      )}

      {benefitsByCard.map(({ card, benefits: cardBenefits, allBenefits: cardAllBenefits }) => (
        cardBenefits.length > 0 && (
          <div key={card.id} className="mb-8">
            <CardHeader 
              card={card} 
              stats={calculateStats(cardBenefits, selectedYear)}
              allBenefits={cardAllBenefits}
              selectedYear={selectedYear}
              onUpdateBenefit={onToggleVisibility}
              transactionStatus={cardTransactionStatus[card.id]}
              onOpenTransactions={onOpenTransactions}
            />
            <div className="grid gap-4 md:grid-cols-2">
              {cardBenefits.map(benefit => (
                <BenefitCard
                  key={benefit.id}
                  benefit={benefit}
                  onToggleEnrollment={onToggleEnrollment}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
