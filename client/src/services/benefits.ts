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

/**
 * Check if a transaction is a credit (negative amount, not a payment)
 */
function isCredit(amount: number, description: string): boolean {
  if (amount >= 0) {
    return false;
  }
  
  const descLower = description.toLowerCase();
  
  // Exclude payment transactions (they're also negative)
  if (descLower.includes('payment') || descLower.includes('autopay')) {
    return false;
  }
  
  return true;
}

/**
 * Derive transactions for a specific benefit from card-level stored transactions.
 * Runs the benefit matcher to identify which credits belong to this benefit.
 */
function deriveBenefitTransactions(
  benefitId: string,
  cardId: string,
  allDefinitions: BenefitDefinition[]
): StoredTransaction[] {
  const cardStore = getCardTransactions(cardId);
  if (!cardStore || cardStore.transactions.length === 0) {
    return [];
  }

  // Convert stored transactions to ParsedTransaction format for the matcher
  // Filter for credits (negative amounts, excluding payments)
  const credits: ParsedTransaction[] = cardStore.transactions
    .filter(tx => isCredit(tx.amount, tx.description))
    .map(tx => ({
      date: new Date(tx.date),
      description: tx.description,
      amount: tx.amount,
    }));

  if (credits.length === 0) {
    return [];
  }

  // Run matcher to identify which credits belong to which benefit
  const cardDefinitions = allDefinitions.filter(d => d.cardId === cardId);
  const result = matchCredits(credits, cardId as CardType, cardDefinitions);

  // Filter matched credits for this specific benefit and convert back to StoredTransaction
  // Use creditAmount (positive) for benefit usage tracking
  return result.matchedCredits
    .filter(mc => mc.benefitId === benefitId)
    .map(mc => ({
      date: mc.transaction.date.toISOString(),
      description: mc.transaction.description,
      amount: mc.creditAmount,
    }));
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
  
  // Merge derived transactions with user state for snapshot calculation
  const stateWithTransactions = {
    ...resolvedUserState,
    transactions: derivedTransactions,
  };
  
  const snapshot = buildBenefitUsageSnapshot(definition, stateWithTransactions, year);

  return {
    ...definition,
    ...resolvedUserState,
    currentUsed: snapshot.currentUsed,
    periods: snapshot.periods as unknown as Benefit['periods'],
    status: snapshot.status,
    claimedElsewhereYear: snapshot.claimedElsewhereYear,
    transactions: snapshot.yearTransactions,
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
  const cardStats = calculateStats(benefits, year);

  return {
    totalBenefits: benefits.length,
    totalValue: cardStats.totalValue,
    usedValue: cardStats.usedValue,
    currentPeriodCompletedCount: cardStats.currentPeriodCompletedCount,
    ytdCompletedPeriods: cardStats.ytdCompletedPeriods,
    ytdTotalPeriods: cardStats.ytdTotalPeriods,
    pendingCount: cardStats.pendingCount,
    missedCount: cardStats.missedCount,
  };
}
