// Shared utility functions used by both backend and frontend

import type { Benefit, Stats, CreditCard, ProgressSegment, BenefitDefinition, BenefitPeriodDefinition, StoredTransaction, ResetFrequency } from './types';

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

// ===== Multi-year benefit helpers =====

export function isMultiYearBenefit(resetFrequency: ResetFrequency): boolean {
  return resetFrequency === '4-year';
}

/** Get the number of periods per year for a reset frequency */
export function getPeriodCount(resetFrequency: ResetFrequency): number {
  const counts: Record<ResetFrequency, number> = {
    'annual': 1,
    'twice-yearly': 2,
    'quarterly': 4,
    'monthly': 12,
    '4-year': 1,
  };
  return counts[resetFrequency] ?? 1;
}

/** Compute benefit date range based on resetFrequency and year */
export function getBenefitDateRange(
  resetFrequency: ResetFrequency,
  year: number
): { startDate: string; endDate: string } {
  const startDate = new Date(Date.UTC(year, 0, 1)).toISOString();
  const endYear = resetFrequency === '4-year' ? year + 3 : year;
  const endDate = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59)).toISOString();
  return { startDate, endDate };
}

/** Calculate 4-year validity period from a transaction date */
export function get4YearValidityPeriod(transactionDate: Date): { start: Date; end: Date } {
  const start = new Date(transactionDate);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 4);
  end.setUTCDate(end.getUTCDate() - 1); // 4 years minus 1 day
  return { start, end };
}

/** Get the most recent transaction from a list */
function getMostRecentTransaction(transactions: StoredTransaction[]): StoredTransaction | null {
  if (transactions.length === 0) return null;
  return transactions.reduce((latest, tx) => {
    const latestDate = new Date(latest.date);
    const txDate = new Date(tx.date);
    return txDate > latestDate ? tx : latest;
  });
}

// ===== Snapshot types =====

export interface BenefitUsageSnapshot {
  periods: BenefitPeriodWithUsage[];
  currentUsed: number;
  status: 'pending' | 'completed' | 'missed';
  yearTransactions: StoredTransaction[];
  claimedElsewhereYear?: number;
  effectiveStartDate: string;
  effectiveEndDate: string;
  segmentValue: number;
  referenceDate: Date;
  isPastYear: boolean;
}

export interface BenefitPeriodWithUsage {
  id: string;
  startDate: string;
  endDate: string;
  usedAmount: number;
  transactions: StoredTransaction[];
  status: 'pending' | 'completed' | 'missed';
  isCurrent: boolean;
  timeProgress: number;
  daysLeft: number;
}

export function getReferenceDate(selectedYear?: number): Date {
  const now = new Date();
  if (!selectedYear) return now;
  const currentYear = now.getUTCFullYear();
  if (selectedYear > currentYear) {
    return new Date(Date.UTC(selectedYear, 0, 1));
  }
  if (selectedYear < currentYear) {
    return new Date(Date.UTC(selectedYear + 1, 0, 1));
  }
  return now;
}

export function findPeriodId(transactionDate: Date, periods: BenefitPeriodDefinition[]): string | null {
  for (const period of periods) {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    if (transactionDate >= start && transactionDate <= end) {
      return period.id;
    }
  }
  return null;
}

function deriveSegmentStatus(
  usedAmount: number,
  segmentValue: number,
  startDate: string,
  endDate: string,
  referenceDate: Date,
  isPastYear: boolean,
  isPastYearView: boolean
): { status: 'pending' | 'completed' | 'missed'; isCurrent: boolean; timeProgress?: number; daysLeft?: number } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const isFuture = referenceDate < start;
  const isPast = referenceDate > end;
  const isCurrent = !isFuture && !isPast;
  
  // 50% threshold for completion
  const threshold = segmentValue * 0.5;
  const isComplete = usedAmount >= threshold;

  let status: 'pending' | 'completed' | 'missed';
  if (isComplete) {
    status = 'completed';
  } else if (isPast || isPastYear) {
    status = 'missed';
  } else {
    status = 'pending'; // current or future
  }

  if (isCurrent && !isPastYearView) {
    return {
      status,
      isCurrent,
      timeProgress: getTimeProgress(startDate, endDate),
      daysLeft: getDaysUntilExpiry(endDate),
    };
  }

  return { status, isCurrent };
}

interface UserStateLike {
  transactions?: StoredTransaction[];
}

/** Build snapshot for 4-year multi-year benefits */
function build4YearBenefitSnapshot(
  definition: BenefitDefinition,
  allTransactions: StoredTransaction[],
  selectedYear: number,
  currentYear: number
): BenefitUsageSnapshot {
  const now = new Date();
  const isPastYearView = selectedYear < currentYear;
  const isFutureYear = selectedYear > currentYear;
  
  const mostRecentTx = getMostRecentTransaction(allTransactions);
  
  let effectiveStartDate: string;
  let effectiveEndDate: string;
  let status: 'pending' | 'completed' | 'missed';
  let claimedElsewhereYear: number | undefined;
  let periodTransactions: StoredTransaction[] = [];
  
  if (mostRecentTx) {
    // Calculate validity period from transaction date
    const txDate = new Date(mostRecentTx.date);
    const { start, end } = get4YearValidityPeriod(txDate);
    effectiveStartDate = start.toISOString();
    effectiveEndDate = end.toISOString();
    
    const expiryYear = end.getUTCFullYear();
    const txYear = txDate.getUTCFullYear();
    
    // Check if the selected year is within the validity period
    const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
    const yearEnd = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59));
    
    // Is the selected year covered by this transaction's validity?
    const isYearCovered = yearStart <= end && yearEnd >= start;
    
    if (isYearCovered) {
      if (selectedYear === expiryYear) {
        // Last year of validity - check if there's a renewal
        const hasRenewalThisYear = allTransactions.some(tx => 
          new Date(tx.date).getUTCFullYear() === selectedYear
        );
        
        if (hasRenewalThisYear) {
          status = 'completed';
          periodTransactions = allTransactions.filter(tx =>
            new Date(tx.date).getUTCFullYear() === selectedYear
          );
        } else if (isPastYearView || now > end) {
          status = 'missed';
        } else {
          status = 'pending';
        }
      } else {
        // Year is fully within validity (not the last year)
        status = 'completed';
        // Show transaction from the year it was purchased
        if (txYear !== selectedYear) {
          claimedElsewhereYear = txYear;
        }
        periodTransactions = [mostRecentTx];
      }
    } else if (yearEnd < start) {
      // Year is before the validity period
      status = isPastYearView ? 'missed' : 'pending';
    } else {
      // Year is after validity period
      status = isPastYearView ? 'missed' : 'pending';
    }
  } else {
    // No transactions - use calendar year placeholder
    const dateRange = getBenefitDateRange('4-year', selectedYear);
    effectiveStartDate = dateRange.startDate;
    effectiveEndDate = dateRange.endDate;
    status = isPastYearView ? 'missed' : (isFutureYear ? 'pending' : 'pending');
  }
  
  // Current year boundaries for time progress (same as annual benefits)
  const yearStartDate = new Date(Date.UTC(selectedYear, 0, 1)).toISOString();
  const yearEndDate = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59)).toISOString();

  // Build the single period for this 4-year benefit
  const period: BenefitPeriodWithUsage = {
    id: `${definition.id}-4year`,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    usedAmount: periodTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    transactions: periodTransactions,
    status,
    isCurrent: !isPastYearView && !isFutureYear,
    timeProgress: getTimeProgress(yearStartDate, yearEndDate),
    daysLeft: getDaysUntilExpiry(yearEndDate),
  };
  
  return {
    periods: [period],
    currentUsed: period.usedAmount,
    status,
    yearTransactions: periodTransactions,
    claimedElsewhereYear,
    effectiveStartDate,
    effectiveEndDate,
    segmentValue: definition.creditAmount,
    referenceDate: now,
    isPastYear: isPastYearView,
  };
}

export function buildBenefitUsageSnapshot(
  definition: BenefitDefinition,
  userState: UserStateLike,
  selectedYear?: number
): BenefitUsageSnapshot {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const year = selectedYear ?? currentYear;
  const allTransactions = userState.transactions ?? [];
  
  // Handle 4-year benefits specially
  if (isMultiYearBenefit(definition.resetFrequency)) {
    return build4YearBenefitSnapshot(definition, allTransactions, year, currentYear);
  }
  
  // Regular annual/periodic benefits
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const periodCount = getPeriodCount(definition.resetFrequency);
  const segmentValue = definition.creditAmount / periodCount;

  const yearTransactions = allTransactions.filter(tx => {
    const date = new Date(tx.date);
    return date >= yearStart && date < yearEnd;
  });

  const isPastYearView = year < currentYear;
  const yearStartIso = yearStart.toISOString();
  const yearEndIso = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
  const referenceDate = isPastYearView
    ? new Date(Date.UTC(2099, 0, 1))
    : now;

  // Generate periods from resetFrequency
  const spanPerPeriod = Math.round(12 / periodCount);
  
  const periodsToUse: BenefitPeriodDefinition[] = Array.from({ length: periodCount }, (_, index) => {
    const startMonth = index * spanPerPeriod;
    const startDate = new Date(Date.UTC(year, startMonth, 1));
    const endDate = new Date(Date.UTC(year, startMonth + spanPerPeriod, 0, 23, 59, 59));
    return {
      id: `${definition.id}-${year}-${index + 1}`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  });

  const effectiveStartDate = periodsToUse[0]?.startDate ?? yearStartIso;
  const effectiveEndDate = periodsToUse[periodsToUse.length - 1]?.endDate ?? yearEndIso;

  const periodTransactions = new Map<string, StoredTransaction[]>();

  for (const tx of yearTransactions) {
    const txDate = new Date(tx.date);
    const periodId = findPeriodId(txDate, periodsToUse);
    if (periodId) {
      const existing = periodTransactions.get(periodId) ?? [];
      periodTransactions.set(periodId, [...existing, tx]);
    }
  }

  const periods = periodsToUse.map(period => {
    const periodTxs = periodTransactions.get(period.id) ?? [];
    const usedAmount = periodTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const { status, isCurrent, timeProgress, daysLeft } = deriveSegmentStatus(
      usedAmount,
      segmentValue,
      period.startDate,
      period.endDate,
      referenceDate,
      isPastYearView,
      isPastYearView
    );

    return {
      ...period,
      usedAmount,
      transactions: periodTxs,
      status,
      isCurrent,
      timeProgress: timeProgress ?? 0,
      daysLeft: daysLeft ?? 0
    };
  });

  const currentUsed = periods.reduce((sum, p) => sum + p.usedAmount, 0);

  let overallStatus: 'pending' | 'completed' | 'missed';
  if (isPastYearView) {
    // Past year: at least 50% of segments completed = completed, otherwise missed
    const completedCount = periods.filter(p => p.status === 'completed').length;
    const halfOrMore = completedCount >= periods.length / 2;
    overallStatus = halfOrMore ? 'completed' : 'missed';
  } else {
    // Current year: use the current segment's status
    const currentPeriod = periods.find(p => p.isCurrent);
    overallStatus = currentPeriod?.status ?? 'pending';
  }

  if (definition.resetFrequency === 'annual') {
    // For single-period benefits, use 50% threshold
    const threshold = definition.creditAmount * 0.5;
    if (currentUsed >= threshold) {
      overallStatus = 'completed';
    }
  }

  return {
    periods,
    currentUsed,
    status: overallStatus,
    yearTransactions,
    claimedElsewhereYear: undefined, // Only used for multi-year benefits
    effectiveStartDate,
    effectiveEndDate,
    segmentValue,
    referenceDate,
    isPastYear: isPastYearView
  };
}

export function buildProgressSegments(benefit: Benefit): ProgressSegment[] {
  const periods = benefit.periods ?? [];
  const segmentValue = periods.length > 0
    ? benefit.creditAmount / periods.length
    : benefit.creditAmount;
  
  const isMultiYear = isMultiYearBenefit(benefit.resetFrequency);
  
  return periods.map(period => ({
    id: period.id,
    status: period.status,
    label: `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`,
    timeProgress: period.isCurrent ? period.timeProgress : undefined,
    startDate: period.startDate,
    endDate: period.endDate,
    daysLeft: period.isCurrent ? period.daysLeft : undefined,
    isCurrent: period.isCurrent,
    transactions: period.transactions,
    usedAmount: period.usedAmount,
    segmentValue,
    isMultiYear, // Pass this to the progress bar for tooltip formatting
  }));
}

export function getAnnualFee(card: CreditCard, year: number): number {
  return card.annualFeeByYear[year.toString()] ?? 0;
}

export function getTotalAnnualFee(cards: CreditCard[], year: number): number {
  return cards.reduce((sum, card) => sum + getAnnualFee(card, year), 0);
}

export function calculateStats(benefits: Benefit[], year?: number): Stats {
  const totalBenefits = benefits.length;
  const referenceDate = getReferenceDate(year);

  let totalValue = 0;
  let usedValue = 0;
  let currentPeriodCompletedCount = 0;
  let ytdCompletedPeriods = 0;
  let ytdTotalPeriods = 0;
  let pendingCount = 0;
  let missedCount = 0;

  for (const benefit of benefits) {
    totalValue += benefit.creditAmount;
    usedValue += benefit.currentUsed;

    const isSingleSegment = !benefit.periods || benefit.periods.length === 0;
    const periods = benefit.periods && benefit.periods.length > 0
      ? benefit.periods
      : [{
          id: 'overall',
          startDate: benefit.startDate,
          endDate: benefit.endDate,
          usedAmount: benefit.currentUsed,
          status: benefit.status,
        }];

    for (const period of periods) {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      const isFuture = referenceDate < start;
      const isPast = referenceDate > end;
      const isCurrent = !isFuture && !isPast;
      const isComplete = Boolean(benefit.claimedElsewhereYear)
        || period.status === 'completed'
        || (isSingleSegment && period.usedAmount + 0.01 >= benefit.creditAmount);

      if (!isFuture) {
        ytdTotalPeriods++;

        if (isComplete) {
          ytdCompletedPeriods++;
        } else if (isPast) {
          missedCount++;
        } else if (isCurrent) {
          pendingCount++;
        }
      }

      if (isCurrent && isComplete) {
        currentPeriodCompletedCount++;
      }
    }
  }

  return {
    totalBenefits,
    totalValue,
    usedValue,
    currentPeriodCompletedCount,
    ytdCompletedPeriods,
    ytdTotalPeriods,
    pendingCount,
    missedCount,
  };
}
