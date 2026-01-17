import { getBenefits, getBenefitById, updateBenefit } from '../models/storage';
import { calculateBenefitStatus } from '../utils/dates';

export function updateBenefitUsage(
  id: string,
  used: number,
  notes?: string,
  ignored?: boolean
) {
  const benefit = getBenefitById(id);
  if (!benefit) {
    throw new Error('Benefit not found');
  }
  
  const status = calculateBenefitStatus({ ...benefit, currentUsed: used });
  
  const updateData: {
    currentUsed: number;
    notes?: string;
    status: 'pending' | 'completed' | 'missed';
    ignored?: boolean;
  } = {
    currentUsed: used,
    notes: notes ?? benefit.notes,
    status
  };
  
  if (ignored !== undefined) {
    updateData.ignored = ignored;
  }
  
  return updateBenefit(id, updateData);
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
