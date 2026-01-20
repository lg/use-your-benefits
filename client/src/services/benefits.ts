import type {
  Benefit,
  BenefitDefinition,
  BenefitUserState,
  Stats,
  StoredTransaction,
} from '../../../shared/types';
import {
  buildBenefitUsageSnapshot,
  calculateStats,
  isBenefitCredit,
} from '../../../shared/utils';
import { api } from '../api/client';
import {
  getDefaultUserState,
  getUserBenefitsData,
  getCardTransactions,
  updateUserState,
} from '../storage/userBenefits';
import { matchCredits } from './benefitMatcher';
import type { CardType, ParsedTransaction } from '../types/import';

// In-memory cache for matched transactions per card
// Key: cardId, Value: { importedAt, matchedByBenefit }
const matchCache = new Map<string, {
  importedAt: string;
  matchedByBenefit: Record<string, StoredTransaction[]>;
}>();

/**
 * Get matched transactions for a card, running the matcher only once per import.
 */
function getMatchedTransactions(
  cardId: string,
  allDefinitions: BenefitDefinition[]
): Record<string, StoredTransaction[]> {
  const cardStore = getCardTransactions(cardId);
  if (!cardStore || cardStore.transactions.length === 0) {
    return {};
  }

  // Check cache validity
  const cached = matchCache.get(cardId);
  if (cached && cached.importedAt === cardStore.importedAt) {
    return cached.matchedByBenefit;
  }

  // Run matcher once for all benefits on this card
  const credits: ParsedTransaction[] = cardStore.transactions
    .filter(tx => isBenefitCredit(tx.amount, tx.description, cardId, tx.type))
    .map(tx => ({
      date: new Date(tx.date),
      description: tx.description,
      amount: tx.amount,
    }));

  if (credits.length === 0) {
    matchCache.set(cardId, { importedAt: cardStore.importedAt, matchedByBenefit: {} });
    return {};
  }

  const cardDefinitions = allDefinitions.filter(d => d.cardId === cardId);
  const result = matchCredits(credits, cardId as CardType, cardDefinitions);

  // Group matched credits by benefit ID
  const matchedByBenefit: Record<string, StoredTransaction[]> = {};
  for (const mc of result.matchedCredits) {
    if (!mc.benefitId) continue; // Skip unmatched
    if (!matchedByBenefit[mc.benefitId]) {
      matchedByBenefit[mc.benefitId] = [];
    }
    matchedByBenefit[mc.benefitId].push({
      date: mc.transaction.date.toISOString(),
      description: mc.transaction.description,
      amount: mc.creditAmount,
    });
  }

  matchCache.set(cardId, { importedAt: cardStore.importedAt, matchedByBenefit });
  return matchedByBenefit;
}

/**
 * Get transactions for a specific benefit from the cached match results.
 */
function deriveBenefitTransactions(
  benefitId: string,
  cardId: string,
  allDefinitions: BenefitDefinition[]
): StoredTransaction[] {
  const matchedByBenefit = getMatchedTransactions(cardId, allDefinitions);
  return matchedByBenefit[benefitId] ?? [];
}

function mergeBenefit(
  definition: BenefitDefinition,
  userState: BenefitUserState | undefined,
  allDefinitions: BenefitDefinition[],
  year?: number
): Benefit {
  const resolvedUserState = userState ?? getDefaultUserState(definition);
  
  // Derive transactions from card-level storage
  const derivedTransactions = deriveBenefitTransactions(
    definition.id,
    definition.cardId,
    allDefinitions
  );
  
  // Derive auto-enrollment: if benefit requires enrollment and has any transactions,
  // it's auto-enrolled based on the earliest credit date
  let autoEnrolledAt: string | undefined;
  let enrolled = resolvedUserState.enrolled;
  
  if (definition.enrollmentRequired && derivedTransactions.length > 0) {
    // Find the earliest transaction date
    const sortedDates = derivedTransactions
      .map(t => new Date(t.date))
      .sort((a, b) => a.getTime() - b.getTime());
    autoEnrolledAt = sortedDates[0].toISOString();
    // Auto-enroll when we have credits
    enrolled = true;
  }
  
  // Merge derived transactions with user state for snapshot calculation
  const stateWithTransactions = {
    ...resolvedUserState,
    enrolled,
    transactions: derivedTransactions,
  };
  
  const snapshot = buildBenefitUsageSnapshot(definition, stateWithTransactions, year);

  return {
    ...definition,
    ...resolvedUserState,
    enrolled,
    autoEnrolledAt,
    currentUsed: snapshot.currentUsed,
    periods: snapshot.periods as unknown as Benefit['periods'],
    status: snapshot.status,
    claimedElsewhereYear: snapshot.claimedElsewhereYear,
    transactions: snapshot.yearTransactions,
    startDate: snapshot.effectiveStartDate,
    endDate: snapshot.effectiveEndDate,
  };
}

export async function getBenefits(
  cardId?: string,
  includeIgnored?: boolean,
  year?: number
): Promise<Benefit[]> {
  // Fetch all definitions to pass to mergeBenefit for transaction derivation
  const allDefinitions = await api.getBenefitDefinitions();
  const definitions = cardId 
    ? allDefinitions.filter(d => d.cardId === cardId)
    : allDefinitions;
  const userData = getUserBenefitsData();

  const merged = definitions.map((def) =>
    mergeBenefit(def, userData.benefits[def.id], allDefinitions, year)
  );

  if (includeIgnored) {
    return merged;
  }

  return merged.filter((benefit) => !benefit.ignored);
}

export async function updateBenefit(
  id: string,
  definition: BenefitDefinition,
  ignored: boolean,
  year?: number
): Promise<Benefit> {
  const userStateUpdates: Partial<BenefitUserState> = {
    ignored,
  };

  const allDefinitions = await api.getBenefitDefinitions();
  const updatedState = updateUserState(id, userStateUpdates);
  return mergeBenefit(definition, updatedState, allDefinitions, year);
}

export async function toggleEnrollment(
  id: string,
  definition: BenefitDefinition,
  year?: number
): Promise<Benefit> {
  const userData = getUserBenefitsData();
  const existing = userData.benefits[id];
  const currentValue = existing?.enrolled ?? false;

  const allDefinitions = await api.getBenefitDefinitions();
  const updatedState = updateUserState(id, {
    enrolled: !currentValue,
  });

  return mergeBenefit(definition, updatedState, allDefinitions, year);
}

export async function getStats(year?: number): Promise<Stats> {
  const benefits = await getBenefits(undefined, false, year);
  return calculateStats(benefits, year);
}
