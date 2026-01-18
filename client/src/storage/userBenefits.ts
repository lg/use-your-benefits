import type {
  BenefitDefinition,
  BenefitPeriodUserState,
  BenefitUserState,
  CardTransactionStore,
  StoredTransaction,
} from '../../../shared/types';
import {
  getUserBenefitsData,
  saveUserBenefitsData,
} from '../hooks/useUserBenefitsStore';

// Re-export for convenience
export { getUserBenefitsData, saveUserBenefitsData } from '../hooks/useUserBenefitsStore';
export { useUserBenefitsStore } from '../hooks/useUserBenefitsStore';

export function getImportNote(cardId: string): string {
  const data = getUserBenefitsData();
  return data.importNotes?.[cardId] ?? '';
}

export function saveImportNote(cardId: string, note: string): void {
  const data = getUserBenefitsData();
  if (!data.importNotes) {
    data.importNotes = {};
  }
  data.importNotes[cardId] = note;
  saveUserBenefitsData(data);
}

export function getDefaultUserState(benefit: BenefitDefinition): BenefitUserState {
  const periodStates = benefit.periods?.reduce<Record<string, BenefitPeriodUserState>>(
    (acc, period) => {
      acc[period.id] = {};
      return acc;
    },
    {}
  );

  return {
    enrolled: !benefit.enrollmentRequired,
    ignored: false,
    periods: periodStates,
  };
}

export function updateUserState(
  benefitId: string,
  updates: Partial<BenefitUserState>
): BenefitUserState {
  const data = getUserBenefitsData();
  const existing = data.benefits[benefitId] ?? {
    enrolled: false,
    ignored: false,
  };

  const updated: BenefitUserState = {
    ...existing,
    ...updates,
    periods: updates.periods ?? existing.periods,
  };

  data.benefits[benefitId] = updated;
  saveUserBenefitsData(data);

  return updated;
}

// Card transaction storage functions

export function getCardTransactions(cardId: string): CardTransactionStore | null {
  const data = getUserBenefitsData();
  return data.cardTransactions?.[cardId] ?? null;
}

export function saveCardTransactions(cardId: string, transactions: StoredTransaction[]): void {
  const data = getUserBenefitsData();
  if (!data.cardTransactions) data.cardTransactions = {};
  data.cardTransactions[cardId] = {
    transactions,
    importedAt: new Date().toISOString(),
  };
  saveUserBenefitsData(data);
}

export function clearCardTransactions(cardId: string): void {
  const data = getUserBenefitsData();
  if (data.cardTransactions?.[cardId]) {
    delete data.cardTransactions[cardId];
    saveUserBenefitsData(data);
  }
}

export function getCardTransactionDateRange(cardId: string): { min: Date; max: Date } | null {
  const store = getCardTransactions(cardId);
  if (!store || store.transactions.length === 0) return null;
  
  const dates = store.transactions.map(t => new Date(t.date));
  return {
    min: new Date(Math.min(...dates.map(d => d.getTime()))),
    max: new Date(Math.max(...dates.map(d => d.getTime()))),
  };
}
