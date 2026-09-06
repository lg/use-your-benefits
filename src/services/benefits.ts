import type {
  Benefit,
  BenefitDefinition,
  BenefitUserState,
  Stats,
  StoredTransaction,
} from '@lib/types';
import {
  buildBenefitUsageSnapshot,
  calculateStats,
} from '@lib/utils';
import { api } from '../api/client';
import {
  getDefaultUserState,
  getUserBenefitsData,
  getCardTransactions,
  updateUserState,
} from '../storage/userBenefits';
import { getMatchedCredits, groupMatchedCreditsByBenefit } from './benefitMatcher';
import { inferAirlineSelection } from './airlineSelection';

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

  const matchedCredits = getMatchedCredits(cardStore.transactions, cardId, allDefinitions);
  if (matchedCredits.length === 0) {
    matchCache.set(cardId, { importedAt: cardStore.importedAt, matchedByBenefit: {} });
    return {};
  }

  const matchedByBenefit = groupMatchedCreditsByBenefit(matchedCredits);

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
  
  const snapshot = buildBenefitUsageSnapshot(definition, stateWithTransactions, year,
    getUserBenefitsData().cardSettings?.[definition.cardId]);

  return {
    ...definition,
    ...resolvedUserState,
    enrolled,
    autoEnrolledAt,
    inferredAirline: definition.id === 'amex-airline-fee'
      ? inferAirlineSelection(derivedTransactions, getCardTransactions(definition.cardId)?.transactions ?? [], year ?? new Date().getUTCFullYear())
      : undefined,
    currentUsed: snapshot.currentUsed,
    creditAmount: snapshot.creditAmount,
    annualValue: snapshot.annualValue,
    availableNow: snapshot.availableNow,
    availabilityNote: snapshot.availabilityNote,
    shortDescription: snapshot.shortDescription,
    resetFrequency: snapshot.resetFrequency,
    periods: snapshot.periods,
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
