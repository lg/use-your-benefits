// Shared utility functions used by both backend and frontend

import type { Benefit, Stats, CreditCard, ProgressSegment, BenefitPeriod } from './types';

export function formatDate(input: string | Date, options?: { includeYear?: boolean }): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const { includeYear = true } = options ?? {};
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear && { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

export function formatDateRange(min: Date, max: Date): string {
  const formatMonth = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  const minStr = formatMonth(min);
  const maxStr = formatMonth(max);

  return minStr === maxStr ? minStr : `${minStr} - ${maxStr}`;
}

export function isBenefitCredit(amount: number, description: string, cardId: string, type?: string): boolean {
  const descLower = description.toLowerCase();

  if (cardId.startsWith('amex')) {
    if (amount >= 0) return false;
    if (descLower.includes('payment') || descLower.includes('autopay')) return false;
    return /platinum|plat\b|amex/i.test(description);
  }

  if (cardId.startsWith('chase')) {
    return type?.toLowerCase() === 'adjustment';
  }

  return false;
}

export function getDaysUntilExpiry(endDate: string): number {
  const now = new Date();
  const expiry = new Date(endDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getTimeProgress(startDate: string, endDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now <= start) return 0;
  if (now >= end) return 100;

  const totalDuration = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return (elapsed / totalDuration) * 100;
}

export { buildBenefitUsageSnapshot } from './benefitPeriods';
export type { BenefitUsageSnapshot } from './benefitPeriods';

export function buildProgressSegments(benefit: Benefit): ProgressSegment[] {
  const periods = benefit.periods ?? [];
  return periods.map(period => ({
    ...period,
    label: formatDate(period.startDate) + ' - ' + formatDate(period.endDate),
    segmentValue: period.allowance ?? benefit.creditAmount / Math.max(1, periods.length),
    isMultiYear: benefit.resetFrequency === '4-year',
  }));
}

export function getAnnualFee(card: CreditCard, year: number): number {
  return card.annualFeeByYear[year.toString()] ?? 0;
}

export function getTotalAnnualFee(cards: CreditCard[], year: number): number {
  return cards.reduce((sum, card) => sum + getAnnualFee(card, year), 0);
}

export function calculateStats(benefits: Benefit[], year?: number, now = new Date()): Stats {
  const selectedYear = year ?? now.getUTCFullYear();
  const reference = Math.min(Date.UTC(selectedYear + 1, 0, 1) - 1,
    Math.max(Date.UTC(selectedYear, 0, 1), now.getTime()));
  const stats: Stats = {
    totalBenefits: 0, totalValue: 0, usedValue: 0, availableValue: 0,
    unknownAvailabilityCount: 0, currentPeriodCount: 0, currentPeriodCompletedCount: 0,
    ytdCompletedPeriods: 0, ytdTotalPeriods: 0, pendingCount: 0, missedCount: 0,
  };
  for (const benefit of benefits) {
    if (benefit.excludeFromTotals || benefit.ignored) continue;
    stats.totalValue += benefit.annualValue ?? benefit.creditAmount;
    stats.usedValue += benefit.currentUsed;
    const periods: BenefitPeriod[] = benefit.periods?.length ? benefit.periods : [{
      id: 'overall', startDate: benefit.startDate, endDate: benefit.endDate,
      usedAmount: benefit.currentUsed, status: benefit.status, allowance: benefit.creditAmount,
    }];
    if (periods.some(period => period.status !== 'unavailable')) stats.totalBenefits++;
    for (const period of periods) {
      if (period.status === 'unavailable') continue;
      const start = Date.parse(period.startDate);
      const end = Date.parse(period.endDate);
      const current = selectedYear === now.getUTCFullYear() && reference >= start && reference <= end;
      const complete = period.status === 'completed' || (!benefit.periods?.length && period.usedAmount + 0.01 >= benefit.creditAmount);
      if (reference >= start) {
        stats.ytdTotalPeriods++;
        if (complete) stats.ytdCompletedPeriods++;
        else if (period.status === 'missed' || reference > end) stats.missedCount++;
        else stats.pendingCount++;
      }
      if (current) {
        stats.currentPeriodCount++;
        if (complete) stats.currentPeriodCompletedCount++;
      }
    }
    if (selectedYear === now.getUTCFullYear()) {
      if (benefit.availableNow === null) stats.unknownAvailabilityCount++;
      else stats.availableValue += benefit.availableNow ?? periods.reduce((sum, period) => {
        const current = reference >= Date.parse(period.startDate) && reference <= Date.parse(period.endDate);
        return sum + (current && period.status !== 'unavailable' ? Math.max(0, (period.allowance ?? benefit.creditAmount / periods.length) - period.usedAmount) : 0);
      }, 0);
    }
  }
  stats.totalValue = Math.round(stats.totalValue * 100) / 100;
  stats.usedValue = Math.round(stats.usedValue * 100) / 100;
  stats.availableValue = Math.round(stats.availableValue * 100) / 100;
  return stats;
}
