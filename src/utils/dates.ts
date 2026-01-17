import type { Benefit } from '../models/types';

// Re-export shared utilities
export { formatDate, getDaysUntilExpiry } from '@shared/utils';

export function calculateBenefitStatus(benefit: Benefit): 'pending' | 'completed' | 'missed' {
  const now = new Date();
  const endDate = new Date(benefit.endDate);
  
  if (benefit.currentUsed >= benefit.creditAmount) {
    return 'completed';
  }
  
  if (endDate < now) {
    return 'missed';
  }
  
  return 'pending';
}

export function calculatePeriodStatus(period: { usedAmount: number; creditAmount: number; endDate: string; }): 'pending' | 'completed' | 'missed' {
  const now = new Date();
  const endDate = new Date(period.endDate);
  
  if (period.usedAmount >= period.creditAmount) {
    return 'completed';
  }
  
  if (endDate < now) {
    return 'missed';
  }
  
  return 'pending';
}
