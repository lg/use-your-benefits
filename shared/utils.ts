// Shared utility functions used by both backend and frontend

import type { Benefit, CardStats, ProgressSegment, BenefitDefinition, BenefitPeriodDefinition, StoredTransaction } from './types';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
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

function findPeriodId(transactionDate: Date, periods: BenefitPeriodDefinition[]): string | null {
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

export function buildBenefitUsageSnapshot(
  definition: BenefitDefinition,
  userState: UserStateLike,
  selectedYear?: number
): BenefitUsageSnapshot {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(selectedYear ?? currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC((selectedYear ?? currentYear) + 1, 0, 1));

  const segmentValue = definition.periods && definition.periods.length > 0
    ? definition.creditAmount / definition.periods.length
    : definition.creditAmount;

  const allTransactions = userState.transactions ?? [];
  const yearTransactions = allTransactions.filter(tx => {
    const date = new Date(tx.date);
    return selectedYear ? date >= yearStart && date < yearEnd : true;
  });

  const claimYears = Array.from(new Set(
    allTransactions
      .map(tx => new Date(tx.date).getUTCFullYear())
      .filter(year => year < (selectedYear ?? currentYear))
  )).sort((a, b) => b - a);

  const hasYearTransactions = yearTransactions.length > 0;
  const isFutureYear = selectedYear !== undefined && selectedYear > currentYear;
  const claimedElsewhereYear = !isFutureYear && selectedYear && !hasYearTransactions && claimYears.length > 0
    ? claimYears[0]
    : undefined;

  const isPastYearView = selectedYear !== undefined && selectedYear < currentYear;
  const yearStartIso = yearStart.toISOString();
  const yearEndIso = new Date(Date.UTC((selectedYear ?? currentYear), 11, 31, 23, 59, 59)).toISOString();
  const referenceDate = isPastYearView
    ? new Date(Date.UTC(2099, 0, 1))
    : now;

  let periods: BenefitPeriodWithUsage[] = [];
  let effectiveStartDate = definition.startDate;
  let effectiveEndDate = definition.endDate;

  const periodDefinitions = definition.periods && definition.periods.length > 0
    ? definition.periods
    : [{
        id: 'overall',
        startDate: definition.startDate,
        endDate: definition.endDate,
      }];

  const spanPerPeriod = Math.round(12 / periodDefinitions.length);
  const periodsToUse = selectedYear
    ? periodDefinitions.map((period, index) => {
        const startMonth = index * spanPerPeriod;
        const startDate = new Date(Date.UTC(selectedYear, startMonth, 1));
        const endDate = new Date(Date.UTC(selectedYear, startMonth + spanPerPeriod, 0, 23, 59, 59));
        return {
          ...period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      })
    : periodDefinitions;

  effectiveStartDate = periodsToUse[0]?.startDate ?? yearStartIso;
  effectiveEndDate = periodsToUse[periodsToUse.length - 1]?.endDate ?? yearEndIso;

  const periodTransactions = new Map<string, StoredTransaction[]>();

  for (const tx of yearTransactions) {
    const txDate = new Date(tx.date);
    const periodId = findPeriodId(txDate, periodsToUse);
    if (periodId) {
      const existing = periodTransactions.get(periodId) ?? [];
      periodTransactions.set(periodId, [...existing, tx]);
    }
  }

    periods = periodsToUse.map(period => {
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
  if (claimedElsewhereYear) {
    overallStatus = 'completed';
  } else if (isPastYearView) {
    // Past year: at least 50% of segments completed = completed, otherwise missed
    const completedCount = periods.filter(p => p.status === 'completed').length;
    const halfOrMore = completedCount >= periods.length / 2;
    overallStatus = halfOrMore ? 'completed' : 'missed';
  } else {
    // Current year: use the current segment's status
    const currentPeriod = periods.find(p => p.isCurrent);
    overallStatus = currentPeriod?.status ?? 'pending';
  }

  if (!definition.periods || definition.periods.length === 0) {
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
    claimedElsewhereYear,
    effectiveStartDate,
    effectiveEndDate,
    segmentValue,
    referenceDate,
    isPastYear: isPastYearView
  };
}

export function buildProgressSegments(
  definition: BenefitDefinition,
  snapshot: BenefitUsageSnapshot
): ProgressSegment[] {
  return snapshot.periods.map(period => ({
    id: period.id,
    status: period.status,
    label: `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`,
    timeProgress: period.isCurrent ? period.timeProgress : undefined,
    startDate: period.startDate,
    endDate: period.endDate,
    daysLeft: period.isCurrent ? period.daysLeft : undefined,
    isCurrent: period.isCurrent
  }));
}

export function calculateStats(benefits: Benefit[], year?: number): CardStats {
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
