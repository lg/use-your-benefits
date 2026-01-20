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

// Chase Sapphire Reserve credit patterns
// Based on actual credit descriptions from Chase statements (e.g., "TRAVEL CREDIT $300/YEAR")
const CHASE_SAPPHIRE_PATTERNS: BenefitPattern[] = [
  { pattern: /travel\s*credit/i, benefitId: 'csr-travel-credit' },
  { pattern: /the\s*edit/i, benefitId: 'csr-edit-hotel' },
  { pattern: /exclusive\s*tables/i, benefitId: 'csr-dining-exclusive-tables' },
  { pattern: /doordash/i, benefitId: 'csr-doordash' },
  { pattern: /lyft/i, benefitId: 'csr-lyft' },
  { pattern: /peloton/i, benefitId: 'csr-peloton' },
  { pattern: /stubhub|viagogo/i, benefitId: 'csr-stubhub' },
  { pattern: /global\s*entry|tsa\s*precheck|nexus/i, benefitId: 'csr-global-entry' },
];

// Map card types to their patterns
const CARD_PATTERNS: Record<CardType, BenefitPattern[]> = {
  'amex-platinum': AMEX_PLATINUM_PATTERNS,
  'chase-sapphire-reserve': CHASE_SAPPHIRE_PATTERNS,
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

    matchedCredits.push({
      transaction: credit,
      benefitId: match.benefitId,
      benefitName: benefit?.name ?? null,
      periodId: null, // Period is determined later by buildBenefitUsageSnapshot
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
