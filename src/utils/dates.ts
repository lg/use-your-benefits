import type { Benefit } from '../models/types';

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

export function getDaysUntilExpiry(endDate: string): number {
  const now = new Date();
  const expiry = new Date(endDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function getProgressPercentage(benefit: Benefit): number {
  return Math.min((benefit.currentUsed / benefit.creditAmount) * 100, 100);
}
