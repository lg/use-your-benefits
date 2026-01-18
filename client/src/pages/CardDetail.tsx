import type { Benefit, CreditCard } from '../types';
import { BenefitCard } from '../components/BenefitCard';
import { CardHeader } from '../components/CardHeader';
import { useBenefits } from '../context/BenefitsContext';
import { calculateStats } from '@shared/utils';

interface CardTransactionStatus {
  hasData: boolean;
  dateRange: { min: Date; max: Date } | null;
}

interface CardDetailProps {
  card: CreditCard;
  benefits: Benefit[];
  allBenefits: Benefit[];
  onBack: () => void;
  cardTransactionStatus: CardTransactionStatus;
  onOpenTransactions: () => void;
}

export function CardDetail({
  card,
  benefits,
  allBenefits,
  onBack,
  cardTransactionStatus,
  onOpenTransactions,
}: CardDetailProps) {
  const { selectedYear, onToggleEnrollment, onToggleVisibility } = useBenefits();

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
        stats={calculateStats(benefits, selectedYear)} 
        allBenefits={allBenefits}
        selectedYear={selectedYear}
        onUpdateBenefit={onToggleVisibility}
        transactionStatus={cardTransactionStatus}
        onOpenTransactions={onOpenTransactions}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {benefits.map(benefit => (
          <BenefitCard
            key={benefit.id}
            benefit={benefit}
            onToggleEnrollment={onToggleEnrollment}
          />
        ))}
      </div>
    </div>
  );
}
