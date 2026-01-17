import { useState } from 'react';
import type { Benefit, CreditCard } from '../types';
import { BenefitCard } from '../components/BenefitCard';
import { CardHeader } from '../components/CardHeader';
import { EditModal } from '../components/EditModal';

interface CardDetailProps {
  card: CreditCard;
  benefits: Benefit[];
  allBenefits: Benefit[];
  onBack: () => void;
  onUpdateBenefit: (id: string, data: { notes: string; ignored?: boolean; activationAcknowledged?: boolean; periods?: Record<string, number> }) => void;
  onToggleIgnored: (id: string, data: { ignored: boolean }) => void;
}

export function CardDetail ({ 
  card, 
  benefits, 
  allBenefits,
  onBack, 
  onUpdateBenefit,
  onToggleIgnored
}: CardDetailProps) {
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const stats = {
    totalValue: benefits.reduce((sum, b) => sum + b.creditAmount, 0),
    usedValue: benefits.reduce((sum, b) => sum + b.currentUsed, 0),
    completedCount: benefits.filter(b => b.status === 'completed').length,
    pendingCount: benefits.filter(b => b.status === 'pending').length,
    missedCount: benefits.filter(b => b.status === 'missed').length,
  };

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

  return (
    <div>
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white mb-4 flex items-center gap-2"
      >
        ← Back to Dashboard
      </button>

      <CardHeader 
        card={card} 
        stats={stats} 
        allBenefits={allBenefits}
        onUpdateBenefit={onToggleIgnored}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {benefits.map(benefit => (
          <BenefitCard
            key={benefit.id}
            benefit={benefit}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <EditModal
        benefit={editingBenefit}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
