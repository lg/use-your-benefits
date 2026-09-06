import { describe, expect, it } from 'bun:test';
import data from '../../public/benefits.json';
import { buildBenefitUsageSnapshot } from './benefitPeriods';
import { calculateStats } from './utils';
import { getMatchedCredits } from '../services/benefitMatcher';
import type { Benefit, BenefitDefinition, CardSettings, StoredTransaction } from './types';

const definitions = data.benefits as BenefitDefinition[];
const today = new Date('2026-09-06T12:00:00Z');
const credit = (date: string, amount: number, description = 'Benefit credit'): StoredTransaction => ({ date: `${date}T00:00:00Z`, amount, description });

function snapshot(id: string, transactions: StoredTransaction[] = [], now = today, year = now.getUTCFullYear(), settings: CardSettings & { annualResetDate?: string } = {}) {
  const definition = definitions.find(item => item.id === id)!;
  return buildBenefitUsageSnapshot(definition, { transactions, annualResetDate: settings.annualResetDate }, year, { now, ...settings });
}

function benefit(id: string, transactions: StoredTransaction[] = [], year = 2026, settings: CardSettings & { annualResetDate?: string } = {}): Benefit {
  const usage = snapshot(id, transactions, today, year, settings);
  return { ...definitions.find(item => item.id === id)!, ...usage,
    startDate: usage.effectiveStartDate, endDate: usage.effectiveEndDate, enrolled: true, ignored: false };
}

describe('Amex policy dates', () => {
  it('keeps the used Saks half and makes the discontinued half unavailable', () => {
    const result = benefit('amex-saks', [credit('2026-03-08', 50)]);
    expect(result.creditAmount).toBe(50);
    expect(result.availableNow).toBe(0);
    expect(result.periods?.map(period => period.status)).toEqual(['completed', 'unavailable']);
    expect(result.periods?.[1].unavailableReason).toContain('ended Jun 30, 2026');
    expect(result.periods?.[1].allowance).toBe(0);
    expect(result.periods?.[1].isCurrent).toBe(true);
    expect(result.periods?.[1].timeProgress).toBeCloseTo(36.6848, 3);
    expect(result.periods?.[1].daysLeft).toBe(117);
    const stats = calculateStats([result], 2026, today);
    expect(stats.missedCount).toBe(0);
    expect(stats.currentPeriodCount).toBe(0);
    expect(stats.ytdTotalPeriods).toBe(1);
    expect(snapshot('amex-saks', [], today, 2025).creditAmount).toBe(100);
  });

  it('increases CLEAR on July 1 without resetting earlier credits', () => {
    const transactions = [credit('2026-04-15', 199)];
    const before = snapshot('amex-clear-plus', transactions, new Date('2026-06-30T23:59:59Z'));
    const after = snapshot('amex-clear-plus', transactions, new Date('2026-07-01T00:00:00Z'));
    expect(before.creditAmount).toBe(209);
    expect(before.availableNow).toBe(10);
    expect(after.creditAmount).toBe(219);
    expect(after.availableNow).toBe(20);
    expect(after.periods).toHaveLength(1);
    expect(after.periods[0].usedAmount).toBe(199);
    expect(after.periods[0].policyNote).toContain('Earlier credits count toward the same allowance');
  });

  it('uses historical CLEAR limits on their effective dates', () => {
    for (const [date, allowance] of [['2024-07-31', 189], ['2024-08-01', 199], ['2025-06-30', 199], ['2025-07-01', 209]] as const) {
      expect(snapshot('amex-clear-plus', [], new Date(`${date}T12:00:00Z`)).creditAmount).toBe(allowance);
    }
  });

  it('leaves pre-launch quarters gray and uses the September 18 launch date', () => {
    const old = snapshot('amex-lululemon', [], today, 2024);
    expect(old.periods.every(period => period.status === 'unavailable')).toBe(true);
    expect(old.creditAmount).toBe(0);
    const launched = snapshot('amex-lululemon', [], today, 2025);
    expect(launched.periods.map(period => period.status)).toEqual(['unavailable', 'unavailable', 'missed', 'missed']);
    expect(launched.periods[2].startDate).toBe('2025-09-18T00:00:00.000Z');
    expect(launched.creditAmount).toBe(150);
    expect(snapshot('amex-lululemon', [], new Date('2025-09-17T12:00:00Z')).availableNow).toBe(0);
    expect(snapshot('amex-lululemon', [], new Date('2025-09-18T00:00:00Z')).availableNow).toBe(75);
  });

  it('gives the September 2025 hotel refresh a new allowance', () => {
    const result = snapshot('amex-hotel-credit', [credit('2025-02-01', 200), credit('2025-10-01', 150)], today, 2025);
    expect(result.creditAmount).toBe(500);
    expect(result.periods.map(period => period.allowance)).toEqual([200, 300]);
    expect(result.periods.map(period => period.usedAmount)).toEqual([200, 150]);
    expect(result.periods[0].endDate).toBe('2025-09-17T23:59:59.999Z');
    expect(result.periods[1].startDate).toBe('2025-09-18T00:00:00.000Z');
  });

  it('raises the September digital cap without creating a second monthly bucket', () => {
    const transactions = [credit('2025-09-02', 20)];
    expect(snapshot('amex-digital-entertainment', transactions, new Date('2025-09-17T12:00:00Z')).availableNow).toBe(0);
    const result = snapshot('amex-digital-entertainment', transactions, new Date('2025-09-18T12:00:00Z'));
    expect(result.periods).toHaveLength(12);
    expect(result.availableNow).toBe(5);
    expect(result.creditAmount).toBe(260);
    expect(result.periods[8].usedAmount).toBe(20);
  });

  it('uses the exact Walmart monthly allowance', () => {
    const result = snapshot('amex-walmart-plus');
    expect(result.periods[8].allowance).toBe(12.95);
    expect(result.creditAmount).toBe(155.4);
    expect(result.periods[8].policyNote).toContain('tax');
  });
});

describe('availability and the 50% target', () => {
  it('counts only the active allowance, even after the target is met', () => {
    const transactions = [credit('2026-02-01', 57.12), credit('2026-05-01', 100), credit('2026-08-01', 60)];
    const result = benefit('amex-resy-credit', transactions);
    expect(result.status).toBe('completed');
    expect(result.availableNow).toBe(40);
    expect(result.currentUsed).toBe(217.12);
    const hotel = benefit('amex-hotel-credit');
    expect(hotel.availableNow).toBe(300);
    expect(calculateStats([result, hotel], 2026, today).availableValue).toBe(340);
  });

  it('excludes Uber Cash from every summary measure and its own usage calculation', () => {
    const included = benefit('amex-resy-credit');
    const uber = benefit('amex-uber-cash', [credit('2026-01-01', 15)]);
    expect(calculateStats([included, uber], 2026, today)).toEqual(calculateStats([included], 2026, today));
    expect(uber.currentUsed).toBe(0);
    expect(uber.annualValue).toBe(0);
    expect(uber.availableNow).toBe(0);
    expect(uber.periods?.every(period => period.status === 'unavailable')).toBe(true);
  });

  it('does not report historical or future-year amounts as still available', () => {
    expect(snapshot('amex-hotel-credit', [], today, 2025).availableNow).toBe(0);
    expect(snapshot('amex-hotel-credit', [], today, 2027).availableNow).toBe(0);
    const stats = calculateStats([benefit('amex-hotel-credit', [], 2025)], 2025, today);
    expect(stats.availableValue).toBe(0);
    expect(stats.currentPeriodCount).toBe(0);
    expect(stats.missedCount).toBe(2);
  });
});

describe('four-year credits', () => {
  it('carries eligibility forward without counting the reimbursement or allowance again', () => {
    const transactions = [credit('2025-03-15', 120, 'Platinum Global Entry Credit')];
    const claimed = snapshot('amex-global-entry', transactions, today, 2025);
    const carried = benefit('amex-global-entry', transactions);
    expect(claimed.currentUsed).toBe(120);
    expect(carried.status).toBe('completed');
    expect(carried.currentUsed).toBe(0);
    expect(carried.annualValue).toBe(0);
    expect(carried.availableNow).toBe(0);
    expect(carried.claimedElsewhereYear).toBe(2025);
    expect(calculateStats([carried], 2026, today).usedValue).toBe(0);
    expect(carried.periods?.[0].endDate).toBe('2029-03-14T23:59:59.999Z');
  });

  it('does not let a later credit rewrite an earlier year', () => {
    const transactions = [credit('2024-03-15', 100), credit('2028-03-15', 120)];
    const result = snapshot('amex-global-entry', transactions, today, 2024);
    expect(result.currentUsed).toBe(100);
    expect(result.periods[0].startDate).toBe('2024-03-15T00:00:00Z');
    expect(result.periods[0].allowance).toBe(100);
  });

  it('distinguishes the TSA allowance and restores eligibility at the next cycle', () => {
    const transactions = [credit('2025-03-15', 85, 'Platinum TSA PreCheck Credit')];
    expect(snapshot('amex-global-entry', transactions, today, 2025).creditAmount).toBe(85);
    expect(snapshot('amex-global-entry', transactions, new Date('2029-03-14T23:59:59Z')).availableNow).toBe(0);
    expect(snapshot('amex-global-entry', transactions, new Date('2029-03-15T00:00:00Z')).availableNow).toBe(120);
  });
});

describe('Chase policy dates and account settings', () => {
  it('supports both 2025 rollout dates', () => {
    const existing = snapshot('csr-dining-exclusive-tables', [], today, 2025);
    const newCard = snapshot('csr-dining-exclusive-tables', [], today, 2025, { newCardDuringRefresh: true });
    expect(existing.creditAmount).toBe(150);
    expect(existing.periods[0].status).toBe('unavailable');
    expect(existing.periods[1].startDate).toBe('2025-10-26T00:00:00.000Z');
    expect(newCard.creditAmount).toBe(300);
    expect(newCard.periods[0].startDate).toBe('2025-06-23T00:00:00.000Z');
  });

  it('uses one $500 Edit allowance in 2026 with a $250 per-stay limit', () => {
    const result = snapshot('csr-edit-hotel', [credit('2026-02-01', 250)]);
    expect(result.periods).toHaveLength(1);
    expect(result.availableNow).toBe(250);
    expect(result.periods[0].policyNote).toContain('Up to $250 per qualifying purchase');
  });

  it('limits Select Hotels to 2026 and matches its explicit credit label', () => {
    expect(snapshot('csr-select-hotels').availableNow).toBe(250);
    expect(snapshot('csr-select-hotels', [], today, 2025).creditAmount).toBe(0);
    expect(snapshot('csr-select-hotels', [], today, 2027).creditAmount).toBe(0);
    const matches = getMatchedCredits([
      { ...credit('2026-01-10', 250, 'SELECT HOTELS CREDIT'), type: 'Adjustment' },
      { ...credit('2026-01-11', 100, 'TRAVEL CREDIT $300/YEAR'), type: 'Adjustment' },
    ], 'chase-sapphire-reserve', definitions);
    expect(matches.map(match => match.benefitId)).toEqual(['csr-select-hotels', 'csr-travel-credit']);
  });

  it('tracks Peloton monthly and starts the Lyft credit in April 2025', () => {
    const peloton = snapshot('csr-peloton', [credit('2026-01-02', 10)]);
    expect(peloton.periods).toHaveLength(12);
    expect(peloton.availableNow).toBe(10);
    const lyft = snapshot('csr-lyft', [], today, 2025);
    expect(lyft.creditAmount).toBe(90);
    expect(lyft.periods.slice(0, 3).every(period => period.status === 'unavailable')).toBe(true);
  });

  it('does not guess travel availability when the anniversary is unknown', () => {
    const result = benefit('csr-travel-credit', [credit('2026-01-10', 100)]);
    expect(result.availableNow).toBeNull();
    const stats = calculateStats([result], 2026, today);
    expect(stats.unknownAvailabilityCount).toBe(1);
    expect(stats.availableValue).toBe(0);
    expect(stats.usedValue).toBe(100);
    expect(snapshot('csr-travel-credit', [], today, 2026, { annualResetDate: '2026-02-30' }).availableNow).toBeNull();
  });

  it('uses credits across the calendar boundary within the account year', () => {
    const transactions = [credit('2025-12-01', 100), credit('2026-02-01', 50)];
    const result = snapshot('csr-travel-credit', transactions, today, 2026, { annualResetDate: '2026-11-10' });
    expect(result.currentUsed).toBe(50);
    expect(result.periods[0].usedAmount).toBe(150);
    expect(result.periods[0].startDate).toBe('2025-11-10T00:00:00.000Z');
    expect(result.periods[0].endDate).toBe('2026-11-09T23:59:59.999Z');
    expect(result.availableNow).toBe(150);
    const renewed = snapshot('csr-travel-credit', transactions, new Date('2026-11-10T00:00:00Z'), 2026, { annualResetDate: '2026-11-10' });
    expect(renewed.availableNow).toBe(300);
  });
});
