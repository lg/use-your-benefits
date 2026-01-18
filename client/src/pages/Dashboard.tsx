import { useMemo, useState, useCallback } from 'react';
import type { Benefit, Stats, CreditCard, BenefitDefinition } from '../types';
import { BenefitCard } from '../components/BenefitCard';
import { CardHeader } from '../components/CardHeader';
import { DetailsModal } from '../components/DetailsModal';
import { ImportModal } from '../components/ImportModal';
import { useDetailsModal } from '../hooks/useDetailsModal';
import { calculateStats, getTotalAnnualFee } from '@shared/utils';

interface DashboardProps {
  benefits: Benefit[];
  cards: CreditCard[];
  allBenefits: Benefit[];
  definitions: BenefitDefinition[];
  stats: Stats | null;
  selectedYear: number;
  onToggleEnrollment: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onImport: (cardId: string, aggregated: Map<string, {
    currentUsed: number;
    periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>;
    transactions?: { date: string; description: string; amount: number }[];
  }>) => void;
}

export function Dashboard({
  benefits,
  cards,
  allBenefits,
  definitions,
  stats,
  selectedYear,
  onToggleEnrollment,
  onToggleVisibility,
  onImport
}: DashboardProps) {
  const { viewingBenefitId, isModalOpen, initialPeriodId, handleViewDetails, handleViewPeriod, handleClose } = useDetailsModal();

  const viewingBenefit = viewingBenefitId
    ? allBenefits.find(b => b.id === viewingBenefitId) ?? null
    : null;
  
  // Import modal state
  const [importCardId, setImportCardId] = useState<string | null>(null);
  
  const importCard = importCardId ? cards.find(c => c.id === importCardId) : null;
  const importCardDefinitions = importCardId 
    ? definitions.filter(d => d.cardId === importCardId) 
    : [];

  const handleImportClick = useCallback((cardId: string) => {
    setImportCardId(cardId);
  }, []);

  const handleImportClose = useCallback(() => {
    setImportCardId(null);
  }, []);

  const handleImportConfirm = useCallback((aggregated: Map<string, {
    currentUsed: number;
    periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>;
    transactions?: { date: string; description: string; amount: number }[];
  }>) => {
    if (importCardId) {
      onImport(importCardId, aggregated);
    }
    setImportCardId(null);
  }, [importCardId, onImport]);

  const benefitsByCard = useMemo(() => 
    cards.map(card => ({
      card,
      benefits: benefits.filter(b => b.cardId === card.id),
      allBenefits: allBenefits.filter(b => b.cardId === card.id)
    })),
    [cards, benefits, allBenefits, selectedYear]
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
              onImportClick={() => handleImportClick(card.id)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              {cardBenefits.map(benefit => (
                <BenefitCard
                  key={benefit.id}
                  benefit={benefit}
                  selectedYear={selectedYear}
                  onViewDetails={handleViewDetails}
                  onViewPeriod={handleViewPeriod}
                />
              ))}
            </div>
          </div>
        )
      ))}

      <DetailsModal
        benefit={viewingBenefit}
        isOpen={isModalOpen}
        onClose={handleClose}
        onToggleEnrollment={onToggleEnrollment}
        onToggleVisibility={onToggleVisibility}
        initialPeriodId={initialPeriodId}
      />

      <ImportModal
        isOpen={importCardId !== null}
        cardId={importCardId ?? ''}
        cardName={importCard?.name ?? ''}
        benefits={importCardDefinitions}
        onClose={handleImportClose}
        onImport={handleImportConfirm}
      />
    </div>
  );
}
