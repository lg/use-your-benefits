// Benefit matching logic - maps credit transactions to benefit definitions

import type { BenefitDefinition } from '@shared/types';
import type {
  ParsedTransaction,
  MatchedCredit,
  ImportResult,
  CardType,
} from '../types/import';

// Pattern definitions for matching credits to benefits
interface BenefitPattern {
  pattern: RegExp;
  benefitId: string;
}

// Amex Platinum credit patterns
// Amex benefit credit patterns
// The matchBenefitId function checks for Amex identifier (Platinum/Plat/AMEX/Amex) first
// These patterns match the benefit-specific keywords
const AMEX_PLATINUM_PATTERNS: BenefitPattern[] = [
  // Order matters - more specific patterns first
  { pattern: /uber.*one/i, benefitId: 'amex-uber-one' },
  { pattern: /uber/i, benefitId: 'amex-uber-cash' },
  { pattern: /lululemon/i, benefitId: 'amex-lululemon' },
  { pattern: /saks/i, benefitId: 'amex-saks' },
  { pattern: /clear/i, benefitId: 'amex-clear-plus' },
  { pattern: /airline/i, benefitId: 'amex-airline-fee' },
  { pattern: /resy/i, benefitId: 'amex-resy-credit' },
  { pattern: /digital.*ent|entertainment/i, benefitId: 'amex-digital-entertainment' },
  { pattern: /walmart/i, benefitId: 'amex-walmart-plus' },
  { pattern: /hotel/i, benefitId: 'amex-hotel-credit' },
  { pattern: /oura/i, benefitId: 'amex-oura' },
  { pattern: /equinox/i, benefitId: 'amex-equinox' },
  { pattern: /global.*entry|tsa.*precheck|nexus/i, benefitId: 'amex-global-entry' },
];

// Map card types to their patterns
const CARD_PATTERNS: Record<CardType, BenefitPattern[]> = {
  'amex-platinum': AMEX_PLATINUM_PATTERNS,
};

/**
 * Find which benefit a credit matches based on its description
 * For Amex cards, requires an Amex identifier to distinguish from regular refunds
 * Amex credits can contain: "Platinum", "Plat", "AMEX", or "Amex"
 */
function matchBenefitId(
  description: string,
  cardId: CardType
): { benefitId: string; confidence: 'high' | 'low' } | null {
  const patterns = CARD_PATTERNS[cardId];
  if (!patterns) {
    return null;
  }

  // For Amex cards, description must contain an Amex identifier to be a real Amex credit
  if (cardId.startsWith('amex') && !/platinum|plat\b|amex/i.test(description)) {
    return null;
  }

  for (const { pattern, benefitId } of patterns) {
    if (pattern.test(description)) {
      return { benefitId, confidence: 'high' };
    }
  }

  return null;
}

/**
 * Find which period a transaction date falls into
 */
function findPeriodId(
  transactionDate: Date,
  benefit: BenefitDefinition
): string | null {
  if (!benefit.periods || benefit.periods.length === 0) {
    return null;
  }

  for (const period of benefit.periods) {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);

    if (transactionDate >= start && transactionDate <= end) {
      return period.id;
    }
  }

  return null;
}

/**
 * Match credits to benefits and aggregate results
 */
export function matchCredits(
  credits: ParsedTransaction[],
  cardId: CardType,
  benefits: BenefitDefinition[]
): ImportResult {
  const matchedCredits: MatchedCredit[] = [];
  const unmatchedCredits: ParsedTransaction[] = [];

  // Create a lookup map for benefits
  const benefitMap = new Map<string, BenefitDefinition>();
  for (const benefit of benefits) {
    benefitMap.set(benefit.id, benefit);
  }

  for (const credit of credits) {
    const match = matchBenefitId(credit.description, cardId);

    if (!match) {
      unmatchedCredits.push(credit);
      continue;
    }

    const benefit = benefitMap.get(match.benefitId);
    const periodId = benefit ? findPeriodId(credit.date, benefit) : null;

    matchedCredits.push({
      transaction: credit,
      benefitId: match.benefitId,
      benefitName: benefit?.name ?? null,
      periodId,
      creditAmount: Math.abs(credit.amount),
      confidence: match.confidence,
    });
  }

  return {
    matchedCredits,
    unmatchedCredits,
    totalMatched: matchedCredits.length,
    totalUnmatched: unmatchedCredits.length,
  };
}

/**
 * Aggregate matched credits into usage amounts per benefit and period
 * Returns a map of benefitId -> { periods?, transactions? }
 */
export function aggregateCredits(
  matchedCredits: MatchedCredit[],
  benefits: BenefitDefinition[]
): Map<string, { periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>; transactions?: { date: string; description: string; amount: number }[] }> {
  const result = new Map<
    string,
    { periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>; transactions?: { date: string; description: string; amount: number }[] }
  >();

  // Create benefit lookup for max amounts
  const benefitMap = new Map<string, BenefitDefinition>();
  for (const benefit of benefits) {
    benefitMap.set(benefit.id, benefit);
  }

  for (const credit of matchedCredits) {
    if (!credit.benefitId) continue;

    const benefit = benefitMap.get(credit.benefitId);
    const existing = result.get(credit.benefitId) ?? {
      periods: undefined,
      transactions: undefined,
    };

    const storedTransaction = {
      date: credit.transaction.date.toISOString(),
      description: credit.transaction.description,
      amount: credit.creditAmount,
    };

    if (credit.periodId && benefit?.periods) {
      // Period-based benefit
      existing.periods = existing.periods ?? {};
      existing.periods[credit.periodId] = existing.periods[credit.periodId] ?? {
        usedAmount: 0,
        transactions: [],
      };
      existing.periods[credit.periodId].usedAmount += credit.creditAmount;
      existing.periods[credit.periodId].transactions?.push(storedTransaction);

    } else {
      // Non-period benefit or no period matched
      existing.transactions = existing.transactions ?? [];
      existing.transactions.push(storedTransaction);
    }

    result.set(credit.benefitId, existing);
  }

  // Cap amounts at benefit maximums
  for (const [benefitId, usage] of result) {
    const benefit = benefitMap.get(benefitId);
    if (!benefit) continue;

    // Cap per-period amounts
    if (usage.periods && benefit.periods) {
      const periodCount = benefit.periods.length;
      const maxPerPeriod = benefit.creditAmount / periodCount;

      for (const periodId of Object.keys(usage.periods)) {
        const periodUsage: { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] } = usage.periods[periodId];
        periodUsage.usedAmount = Math.min(periodUsage.usedAmount, maxPerPeriod);

        // Cap transactions in this period proportionally if needed
        if (periodUsage.transactions && periodUsage.transactions.length > 0) {
          let runningTotal = 0;
          const maxIndex = periodUsage.transactions.findIndex((t: { amount: number }) => {
            runningTotal += t.amount;
            return runningTotal > maxPerPeriod;
          });
          if (maxIndex >= 0) {
            // Trim transactions that exceed the cap
            const excess = runningTotal - maxPerPeriod;
            periodUsage.transactions[maxIndex] = {
              ...periodUsage.transactions[maxIndex],
              amount: periodUsage.transactions[maxIndex].amount - excess,
            };
          }
        }
      }
    }
  }

  return result;
}
