import { useState } from 'react';
import type { Benefit, Stats, CreditCard } from '../types';
import { BenefitCard } from '../components/BenefitCard';
import { CardHeader } from '../components/CardHeader';
import { EditModal } from '../components/EditModal';

interface DashboardProps {
  benefits: Benefit[];
  cards: CreditCard[];
  allBenefits: Benefit[];
  stats: Stats | null;
  onUpdateBenefit: (id: string, data: { notes: string; ignored?: boolean; activationAcknowledged?: boolean; periods?: Record<string, number> }) => void;
  onToggleIgnored: (id: string, data: { ignored: boolean }) => void;
}

export function Dashboard({ 
  benefits, 
  cards, 
  allBenefits,
  stats, 
  onUpdateBenefit,
  onToggleIgnored
}: DashboardProps) {
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    setIsModalOpen(true);
  };

  const handleSave = (
    id: string,
    data: { notes: string; ignored?: boolean; activationAcknowledged?: boolean; periods?: Record<string, number> }
  ) => {
    onUpdateBenefit(id, data);
  };

  const getCardStats = (cardBenefits: Benefit[]) => ({
    totalValue: cardBenefits.reduce((sum, b) => sum + b.creditAmount, 0),
    usedValue: cardBenefits.reduce((sum, b) => sum + b.currentUsed, 0),
    completedCount: cardBenefits.filter(b => b.status === 'completed').length,
    pendingCount: cardBenefits.filter(b => b.status === 'pending').length,
    missedCount: cardBenefits.filter(b => b.status === 'missed').length,
  });

  const benefitsByCard = cards.map(card => ({
    card,
    benefits: benefits.filter(b => b.cardId === card.id),
    allBenefits: allBenefits.filter(b => b.cardId === card.id)
  }));

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total Value</p>
            <p className="text-2xl font-bold">${stats.totalValue}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Used</p>
            <p className="text-2xl font-bold text-emerald-400">${stats.usedValue.toFixed(0)}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Remaining</p>
            <p className="text-2xl font-bold text-amber-400">
              ${(stats.totalValue - stats.usedValue).toFixed(0)}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-emerald-400">
              {stats.completedCount}/{stats.totalBenefits}
            </p>
          </div>
        </div>
      )}

      {benefitsByCard.map(({ card, benefits: cardBenefits, allBenefits: cardAllBenefits }) => (
        cardBenefits.length > 0 && (
          <div key={card.id} className="mb-8">
            <CardHeader 
              card={card} 
              stats={getCardStats(cardBenefits)}
              allBenefits={cardAllBenefits}
              onUpdateBenefit={onToggleIgnored}
            />
            <div className="grid gap-4 md:grid-cols-2">
              {cardBenefits.map(benefit => (
                <BenefitCard
                  key={benefit.id}
                  benefit={benefit}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )
      ))}

      <EditModal
        benefit={editingBenefit}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
