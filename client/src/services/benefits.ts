import type {
  Benefit,
  BenefitDefinition,
  BenefitUserState,
  Stats,
} from '../../../shared/types';
import {
  buildBenefitUsageSnapshot,
  calculateStats,
} from '../../../shared/utils';
import { api } from '../api/client';
import {
  getDefaultUserState,
  getUserBenefitsData,
  updateUserState,
} from '../storage/userBenefits';

function mergeBenefit(
  definition: BenefitDefinition,
  userState: BenefitUserState | undefined,
  year?: number
): Benefit {
  const resolvedUserState = userState ?? getDefaultUserState(definition);
  const snapshot = buildBenefitUsageSnapshot(definition, resolvedUserState, year);

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
  const definitions = await api.getBenefitDefinitions(cardId);
  const userData = getUserBenefitsData();

  const merged = definitions.map((def) =>
    mergeBenefit(def, userData.benefits[def.id], year)
  );

  if (includeIgnored) {
    return merged;
  }

  return merged.filter((benefit) => !benefit.ignored);
}

export function updateBenefit(
  id: string,
  definition: BenefitDefinition,
  ignored: boolean,
  year?: number
): Benefit {
  const userStateUpdates: Partial<BenefitUserState> = {
    ignored,
  };

  const updatedState = updateUserState(id, userStateUpdates);
  return mergeBenefit(definition, updatedState, year);
}

export function toggleEnrollment(
  id: string,
  definition: BenefitDefinition,
  year?: number
): Benefit {
  const userData = getUserBenefitsData();
  const existing = userData.benefits[id];
  const currentValue = existing?.enrolled ?? false;

  const updatedState = updateUserState(id, {
    enrolled: !currentValue,
  });

  return mergeBenefit(definition, updatedState, year);
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
