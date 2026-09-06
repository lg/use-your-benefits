import { useMemo } from 'react';
import type { Benefit, Stats, CreditCard, TransactionStatus } from '@lib/types';
import { BenefitCard } from '../components/BenefitCard';
import { CardHeader } from '../components/CardHeader';
import { useBenefits } from '../context/BenefitsContext';
import { calculateStats, getTotalAnnualFee } from '@lib/utils';

interface DashboardProps {
  benefits: Benefit[];
  cards: CreditCard[];
  allBenefits: Benefit[];
  stats: Stats | null;
  cardTransactionStatus: Record<string, TransactionStatus>;
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

  const summaryCards = stats
    ? [
        { label: 'Total Value', value: `$${stats.totalValue}` },
        {
          label: `Used ($${getTotalAnnualFee(cards, selectedYear)} fee)`,
          value: `$${stats.usedValue.toFixed(0)}`,
          valueClass: 'text-emerald-400',
        },
        {
          label: 'Still available',
          value: `$${stats.availableValue.toFixed(0)}${stats.unknownAvailabilityCount > 0 ? '+' : ''}`,
          valueClass: 'text-amber-400',
        },
        {
          label: 'Current Period',
          value: `${stats.currentPeriodCompletedCount}/${stats.currentPeriodCount}`,
          valueClass: 'text-emerald-400',
        },
        {
          label: 'Year-to-date',
          value: `${stats.ytdCompletedPeriods}/${stats.ytdTotalPeriods}`,
          valueClass: 'text-emerald-400',
        },
      ]
    : [];

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
          {summaryCards.map(({ label, value, valueClass }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">{label}</p>
              <p className={`text-2xl font-bold ${valueClass ?? ''}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {stats && <p className="text-xs text-slate-400 mb-6">
        Still available uses current allowances and imported credits. Completed means the 50% usage target was met.
        {stats.unknownAvailabilityCount > 0 ? ' Chase travel credit is excluded until its reset date is set.' : ''}
      </p>}

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
            <div className="grid gap-x-4 md:grid-cols-2">
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
