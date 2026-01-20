import { describe, it, expect } from 'bun:test';
import { calculateStats, buildBenefitUsageSnapshot, buildProgressSegments } from './utils';
import type { Benefit, BenefitDefinition, StoredTransaction } from './types';

function createBenefit(overrides: Partial<Benefit> = {}): Benefit {
  const now = new Date();
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

  const derivedUsed = overrides.currentUsed ?? 0;
  const derivedStatus = overrides.status ?? 'pending';

  const baseBenefit: Benefit = {
    id: 'test-benefit',
    cardId: 'test-card',
    name: 'Test Benefit',
    shortDescription: 'Test description',
    creditAmount: 100,
    resetFrequency: 'annual',
    enrollmentRequired: false,
    startDate: lastMonth.toISOString(),
    endDate: twoMonthsLater.toISOString(),
    enrolled: true,
    ignored: false,
    currentUsed: derivedUsed,
    status: derivedStatus,
    periods: overrides.periods as unknown as Benefit['periods'],
  };

  return { ...baseBenefit, ...overrides };
}

function createDefinition(overrides: Partial<BenefitDefinition> = {}): BenefitDefinition {
  return {
    id: 'test-benefit',
    cardId: 'amex-platinum',
    name: 'Test Benefit',
    shortDescription: 'Test description',
    creditAmount: 100,
    resetFrequency: 'annual',
    enrollmentRequired: false,
    ...overrides,
  };
}

interface UserStateLike {
  transactions?: StoredTransaction[];
}

function createUserState(overrides: Partial<UserStateLike> = {}): UserStateLike {
  return {
    transactions: [],
    ...overrides,
  };
}

describe('buildBenefitUsageSnapshot', () => {
  describe('past year with no usage', () => {
    it('marks periods as missed when viewing past year with no transactions', () => {
      const now = new Date();
      const pastYear = now.getUTCFullYear() - 1;

      const definition = createDefinition({
        id: 'amex-saks',
        creditAmount: 100,
        resetFrequency: 'twice-yearly',
      });

      const userState = createUserState({
        transactions: [],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, pastYear);

      expect(snapshot.status).toBe('missed');
      expect(snapshot.periods).toHaveLength(2);
      expect(snapshot.periods[0].status).toBe('missed');
      expect(snapshot.periods[1].status).toBe('missed');
      expect(snapshot.currentUsed).toBe(0);
    });

    it('marks periods as completed when viewing past year with sufficient transactions', () => {
      const now = new Date();
      const pastYear = now.getUTCFullYear() - 1;

      const definition = createDefinition({
        id: 'amex-saks',
        creditAmount: 100,
        resetFrequency: 'twice-yearly',
      });

      const userState = createUserState({
        transactions: [
          { date: new Date(Date.UTC(pastYear, 2, 15)).toISOString(), description: 'Saks purchase', amount: 50 },
          { date: new Date(Date.UTC(pastYear, 8, 15)).toISOString(), description: 'Saks purchase', amount: 50 },
        ],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, pastYear);

      expect(snapshot.status).toBe('completed');
      expect(snapshot.periods).toHaveLength(2);
      expect(snapshot.periods[0].status).toBe('completed');
      expect(snapshot.periods[1].status).toBe('completed');
      expect(snapshot.currentUsed).toBe(100);
    });
  });

  describe('current year with partial usage', () => {
    it('shows completed and pending status for periods with different start dates', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();

      const definition = createDefinition({
        id: 'amex-resy-credit',
        creditAmount: 400,
        resetFrequency: 'quarterly',
      });

      const userState = createUserState({
        transactions: [
          { date: new Date(Date.UTC(currentYear, 1, 15)).toISOString(), description: 'Resy reservation', amount: 100 },
        ],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, currentYear);

      expect(snapshot.periods).toHaveLength(4);
      expect(snapshot.periods[0].status).toBe('completed');
      // Other periods depend on current date
      expect(snapshot.currentUsed).toBe(100);
    });
  });

  describe('multi-year benefit (Global Entry)', () => {
    it('marks as completed in past year when usage met', () => {
      const now = new Date();
      const pastYear = now.getUTCFullYear() - 2;

      const definition = createDefinition({
        id: 'amex-global-entry',
        creditAmount: 120,
        resetFrequency: '4-year',
      });

      const userState = createUserState({
        transactions: [
          { date: new Date(Date.UTC(pastYear, 5, 15)).toISOString(), description: 'Global Entry fee', amount: 120 },
        ],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, pastYear);

      expect(snapshot.status).toBe('completed');
      expect(snapshot.currentUsed).toBe(120);
    });

    it('marks as pending in future year when no usage', () => {
      const now = new Date();
      const futureYear = now.getUTCFullYear() + 1;

      const definition = createDefinition({
        id: 'amex-global-entry',
        creditAmount: 120,
        resetFrequency: '4-year',
      });

      const userState = createUserState({
        transactions: [],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, futureYear);

      expect(snapshot.status).toBe('pending');
      expect(snapshot.currentUsed).toBe(0);
    });
  });

  describe('future year', () => {
    it('shows pending status for future year periods', () => {
      const now = new Date();
      const futureYear = now.getUTCFullYear() + 1;

      const definition = createDefinition({
        id: 'amex-resy-credit',
        creditAmount: 400,
        resetFrequency: 'quarterly',
      });

      const userState = createUserState({
        transactions: [],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, futureYear);

      // Periods are generated at runtime based on resetFrequency
      expect(snapshot.periods.length).toBeGreaterThan(0);
      expect(snapshot.periods[0].status).toBe('pending');
    });
  });

  describe('completion without transactions', () => {
    it('considers period complete when usedAmount meets threshold', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();

      const definition = createDefinition({
        id: 'amex-hotel-credit',
        creditAmount: 600,
        resetFrequency: 'twice-yearly',
      });

      const userState = createUserState({
        transactions: [
          { date: new Date(Date.UTC(currentYear, 3, 15)).toISOString(), description: 'Hotel booking', amount: 300 },
        ],
      });

      const snapshot = buildBenefitUsageSnapshot(definition, userState, currentYear);

      expect(snapshot.periods).toHaveLength(2);
      expect(snapshot.periods[0].status).toBe('completed');
      expect(snapshot.periods[0].usedAmount).toBe(300);
    });
  });
});

describe('buildProgressSegments', () => {
  it('generates correct segments for period-based benefits', () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    const definition = createDefinition({
      id: 'amex-saks',
      creditAmount: 100,
      resetFrequency: 'twice-yearly',
    });

    const userState = createUserState({
      transactions: [
        { date: new Date(Date.UTC(currentYear, 3, 15)).toISOString(), description: 'Saks purchase', amount: 50 },
      ],
    });

    const snapshot = buildBenefitUsageSnapshot(definition, userState, currentYear);
    
    // Create a benefit object for buildProgressSegments
    const benefit: Benefit = {
      ...definition,
      enrolled: true,
      ignored: false,
      currentUsed: snapshot.currentUsed,
      status: snapshot.status,
      startDate: snapshot.effectiveStartDate,
      endDate: snapshot.effectiveEndDate,
      periods: snapshot.periods as Benefit['periods'],
    };
    
    const segments = buildProgressSegments(benefit);

    expect(segments).toHaveLength(2);
    expect(segments[0].status).toBe('completed');
  });

  it('generates single segment for annual benefits', () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    const definition = createDefinition({
      id: 'amex-uber-one',
      creditAmount: 120,
      resetFrequency: 'annual',
    });

    const userState = createUserState({
      transactions: [
        { date: new Date(Date.UTC(currentYear, 5, 15)).toISOString(), description: 'Uber One membership', amount: 120 },
      ],
    });

    const snapshot = buildBenefitUsageSnapshot(definition, userState, currentYear);
    
    // Create a benefit object for buildProgressSegments
    const benefit: Benefit = {
      ...definition,
      enrolled: true,
      ignored: false,
      currentUsed: snapshot.currentUsed,
      status: snapshot.status,
      startDate: snapshot.effectiveStartDate,
      endDate: snapshot.effectiveEndDate,
      periods: snapshot.periods as Benefit['periods'],
    };
    
    const segments = buildProgressSegments(benefit);

    expect(segments).toHaveLength(1);
    expect(segments[0].status).toBe('completed');
  });
});

describe('calculateStats', () => {
  describe('single-period benefits', () => {
    it('counts a completed benefit when current period is complete', () => {
      const benefit = createBenefit({
        currentUsed: 100,
        creditAmount: 100,
        periods: undefined,
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.currentPeriodCompletedCount).toBe(1);
      expect(stats.ytdCompletedPeriods).toBe(1);
      expect(stats.ytdTotalPeriods).toBe(1);
      expect(stats.pendingCount).toBe(0);
      expect(stats.missedCount).toBe(0);
    });

    it('counts a pending benefit when current period is not complete', () => {
      const benefit = createBenefit({
        currentUsed: 50,
        creditAmount: 100,
        periods: undefined,
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.currentPeriodCompletedCount).toBe(0);
      expect(stats.ytdCompletedPeriods).toBe(0);
      expect(stats.ytdTotalPeriods).toBe(1);
      expect(stats.pendingCount).toBe(1);
      expect(stats.missedCount).toBe(0);
    });

    it('does not count future benefits in ytd totals', () => {
      const now = new Date();
      const futureStart = new Date(now);
      futureStart.setDate(futureStart.getDate() + 60);
      const futureEnd = new Date(now);
      futureEnd.setDate(futureEnd.getDate() + 120);

      const benefit = createBenefit({
        startDate: futureStart.toISOString(),
        endDate: futureEnd.toISOString(),
        currentUsed: 0,
        creditAmount: 100,
        periods: undefined,
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.ytdTotalPeriods).toBe(0);
      expect(stats.ytdCompletedPeriods).toBe(0);
    });

    it('counts a missed benefit when expired and not complete', () => {
      const now = new Date();
      const pastEnd = new Date(now);
      pastEnd.setDate(pastEnd.getDate() - 1);

      const pastStart = new Date(now);
      pastStart.setDate(pastStart.getDate() - 60);

      const benefit = createBenefit({
        startDate: pastStart.toISOString(),
        endDate: pastEnd.toISOString(),
        currentUsed: 50,
        creditAmount: 100,
        periods: undefined,
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.currentPeriodCompletedCount).toBe(0);
      expect(stats.ytdTotalPeriods).toBe(1);
      expect(stats.ytdCompletedPeriods).toBe(0);
      expect(stats.missedCount).toBe(1);
      expect(stats.pendingCount).toBe(0);
    });
  });

  describe('multi-period benefits (quarterly)', () => {
    it('counts completed periods correctly', () => {
      const now = new Date();

      const q1Start = new Date(now);
      q1Start.setDate(q1Start.getDate() - 270);
      const q1End = new Date(now);
      q1End.setDate(q1End.getDate() - 180);

      const q2Start = new Date(now);
      q2Start.setDate(q2Start.getDate() - 180);
      const q2End = new Date(now);
      q2End.setDate(q2End.getDate() - 90);

      const q3Start = new Date(now);
      q3Start.setDate(q3Start.getDate() - 90);
      const q3End = new Date(now);
      q3End.setDate(q3End.getDate() + 90);

      const q4Start = new Date(now);
      q4Start.setDate(q4Start.getDate() + 90);
      const q4End = new Date(now);
      q4End.setDate(q4End.getDate() + 180);

      const benefit: Benefit = createBenefit({
        id: 'quarterly-benefit',
        creditAmount: 400,
        periods: [
          { id: 'q1', startDate: q1Start.toISOString(), endDate: q1End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q2', startDate: q2Start.toISOString(), endDate: q2End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q3', startDate: q3Start.toISOString(), endDate: q3End.toISOString(), usedAmount: 50, status: 'pending' },
          { id: 'q4', startDate: q4Start.toISOString(), endDate: q4End.toISOString(), usedAmount: 0, status: 'pending' },
        ] as unknown as Benefit['periods'],
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.currentPeriodCompletedCount).toBe(0);
      expect(stats.ytdCompletedPeriods).toBe(2);
      expect(stats.ytdTotalPeriods).toBe(3);
      expect(stats.pendingCount).toBe(1);
      expect(stats.missedCount).toBe(0);
    });

    it('marks current period as completed when used amount meets threshold', () => {
      const now = new Date();

      const q1Start = new Date(now);
      q1Start.setDate(q1Start.getDate() - 270);
      const q1End = new Date(now);
      q1End.setDate(q1End.getDate() - 180);

      const q2Start = new Date(now);
      q2Start.setDate(q2Start.getDate() - 180);
      const q2End = new Date(now);
      q2End.setDate(q2End.getDate() - 90);

      const q3Start = new Date(now);
      q3Start.setDate(q3Start.getDate() - 90);
      const q3End = new Date(now);
      q3End.setDate(q3End.getDate() + 90);

      const q4Start = new Date(now);
      q4Start.setDate(q4Start.getDate() + 90);
      const q4End = new Date(now);
      q4End.setDate(q4End.getDate() + 180);

      const benefit: Benefit = createBenefit({
        id: 'quarterly-benefit',
        creditAmount: 400,
        periods: [
          { id: 'q1', startDate: q1Start.toISOString(), endDate: q1End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q2', startDate: q2Start.toISOString(), endDate: q2End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q3', startDate: q3Start.toISOString(), endDate: q3End.toISOString(), usedAmount: 50, status: 'pending' },
          { id: 'q4', startDate: q4Start.toISOString(), endDate: q4End.toISOString(), usedAmount: 0, status: 'pending' },
        ] as unknown as Benefit['periods'],
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.currentPeriodCompletedCount).toBe(0);
      expect(stats.ytdCompletedPeriods).toBe(2);
      expect(stats.ytdTotalPeriods).toBe(3);
      expect(stats.pendingCount).toBe(1);
      expect(stats.missedCount).toBe(0);
    });

    it('counts current period as completed when all ytd periods are complete', () => {
      const now = new Date();

      const q1Start = new Date(now);
      q1Start.setDate(q1Start.getDate() - 270);
      const q1End = new Date(now);
      q1End.setDate(q1End.getDate() - 180);

      const q2Start = new Date(now);
      q2Start.setDate(q2Start.getDate() - 180);
      const q2End = new Date(now);
      q2End.setDate(q2End.getDate() - 90);

      const q3Start = new Date(now);
      q3Start.setDate(q3Start.getDate() - 90);
      const q3End = new Date(now);
      q3End.setDate(q3End.getDate() + 90);

      const q4Start = new Date(now);
      q4Start.setDate(q4Start.getDate() + 90);
      const q4End = new Date(now);
      q4End.setDate(q4End.getDate() + 180);

      const benefit: Benefit = createBenefit({
        id: 'quarterly-benefit',
        creditAmount: 400,
        periods: [
          { id: 'q1', startDate: q1Start.toISOString(), endDate: q1End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q2', startDate: q2Start.toISOString(), endDate: q2End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q3', startDate: q3Start.toISOString(), endDate: q3End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q4', startDate: q4Start.toISOString(), endDate: q4End.toISOString(), usedAmount: 0, status: 'pending' },
        ] as unknown as Benefit['periods'],
      });

      const stats = calculateStats([benefit]);

      expect(stats.totalBenefits).toBe(1);
      expect(stats.currentPeriodCompletedCount).toBe(1);
      expect(stats.ytdCompletedPeriods).toBe(3);
      expect(stats.ytdTotalPeriods).toBe(3);
      expect(stats.pendingCount).toBe(0);
      expect(stats.missedCount).toBe(0);
    });
  });

  describe('multiple benefits', () => {
    it('aggregates stats across multiple benefits', () => {
      const now = new Date();

      const benefit1 = createBenefit({
        id: 'benefit-1',
        creditAmount: 100,
        currentUsed: 100,
        periods: undefined,
      });

      const q1Start = new Date(now);
      q1Start.setDate(q1Start.getDate() - 270);
      const q1End = new Date(now);
      q1End.setDate(q1End.getDate() - 180);

      const q2Start = new Date(now);
      q2Start.setDate(q2Start.getDate() - 180);
      const q2End = new Date(now);
      q2End.setDate(q2End.getDate() - 90);

      const q3Start = new Date(now);
      q3Start.setDate(q3Start.getDate() - 90);
      const q3End = new Date(now);
      q3End.setDate(q3End.getDate() + 90);

      const q4Start = new Date(now);
      q4Start.setDate(q4Start.getDate() + 90);
      const q4End = new Date(now);
      q4End.setDate(q4End.getDate() + 180);

      const benefit2: Benefit = createBenefit({
        id: 'benefit-2',
        creditAmount: 400,
        currentUsed: 200,
        periods: [
          { id: 'q1', startDate: q1Start.toISOString(), endDate: q1End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q2', startDate: q2Start.toISOString(), endDate: q2End.toISOString(), usedAmount: 100, status: 'completed' },
          { id: 'q3', startDate: q3Start.toISOString(), endDate: q3End.toISOString(), usedAmount: 50, status: 'pending' },
          { id: 'q4', startDate: q4Start.toISOString(), endDate: q4End.toISOString(), usedAmount: 0, status: 'pending' },
        ] as unknown as Benefit['periods'],
      });

      const benefit3 = createBenefit({
        id: 'benefit-3',
        creditAmount: 50,
        currentUsed: 25,
        periods: undefined,
      });

      const stats = calculateStats([benefit1, benefit2, benefit3]);

      expect(stats.totalBenefits).toBe(3);
      expect(stats.totalValue).toBe(550);
      expect(stats.usedValue).toBe(325);
      expect(stats.currentPeriodCompletedCount).toBe(1);
      expect(stats.ytdCompletedPeriods).toBe(3);
      expect(stats.ytdTotalPeriods).toBe(5);
      expect(stats.pendingCount).toBe(2);
      expect(stats.missedCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty benefits array', () => {
      const stats = calculateStats([]);

      expect(stats.totalBenefits).toBe(0);
      expect(stats.totalValue).toBe(0);
      expect(stats.usedValue).toBe(0);
      expect(stats.currentPeriodCompletedCount).toBe(0);
      expect(stats.ytdCompletedPeriods).toBe(0);
      expect(stats.ytdTotalPeriods).toBe(0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.missedCount).toBe(0);
    });
  });
});
