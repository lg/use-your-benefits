import { getCards, getBenefits, getBenefitById, updateBenefit } from '../models/storage.ts';
import { calculateBenefitStatus } from '../utils/dates.ts';

export function getCardsWithBenefits() {
  const cards = getCards();
  return cards.map(card => {
    const benefits = getBenefits(card.id);
    const totalValue = benefits.reduce((sum, b) => sum + b.creditAmount, 0);
    const usedValue = benefits.reduce((sum, b) => sum + b.currentUsed, 0);
    const completedCount = benefits.filter(b => b.status === 'completed').length;
    const pendingCount = benefits.filter(b => b.status === 'pending').length;
    const missedCount = benefits.filter(b => b.status === 'missed').length;
    
    return {
      ...card,
      benefits,
      stats: {
        totalBenefits: benefits.length,
        totalValue,
        usedValue,
        completedCount,
        pendingCount,
        missedCount
      }
    };
  });
}

export function getAllBenefitsWithCards() {
  const cards = getCards();
  const benefits = getBenefits();
  
  return benefits.map(benefit => {
    const card = cards.find(c => c.id === benefit.cardId);
    return {
      ...benefit,
      card
    };
  });
}

export function updateBenefitUsage(id: string, used: number, notes?: string) {
  const benefit = getBenefitById(id);
  if (!benefit) {
    throw new Error('Benefit not found');
  }
  
  const status = calculateBenefitStatus({ ...benefit, currentUsed: used });
  
  return updateBenefit(id, {
    currentUsed: used,
    notes: notes ?? benefit.notes,
    status
  });
}

export function toggleActivation(id: string) {
  const benefit = getBenefitById(id);
  if (!benefit) {
    throw new Error('Benefit not found');
  }
  
  if (!benefit.activationRequired) {
    throw new Error('This benefit does not require activation');
  }
  
  return updateBenefit(id, {
    activationAcknowledged: !benefit.activationAcknowledged
  });
}

export function getStats() {
  const benefits = getBenefits();
  
  return {
    totalBenefits: benefits.length,
    totalValue: benefits.reduce((sum, b) => sum + b.creditAmount, 0),
    usedValue: benefits.reduce((sum, b) => sum + b.currentUsed, 0),
    completedCount: benefits.filter(b => b.status === 'completed').length,
    pendingCount: benefits.filter(b => b.status === 'pending').length,
    missedCount: benefits.filter(b => b.status === 'missed').length
  };
}
