import { useSyncExternalStore } from 'react';
import type {
  BenefitDefinition,
  BenefitUserState,
  CardTransactionStore,
  StoredTransaction,
  UserBenefitsData,
} from '@shared/types';

const STORAGE_KEY = 'use-your-benefits';

// Module-level cache and listener management
let cachedData: UserBenefitsData | null = null;
const listeners = new Set<() => void>();

function getDefaultData(): UserBenefitsData {
  return { benefits: {}, importNotes: {}, cardTransactions: {} };
}

function parseStoredData(stored: string | null): UserBenefitsData {
  if (!stored) return getDefaultData();
  try {
    const parsed = JSON.parse(stored) as UserBenefitsData & {
      benefits?: Record<string, { enrolled?: boolean; ignored?: boolean }>;
    };
    
    // Migration: keep only enrolled/ignored, strip legacy fields
    const migratedBenefits: Record<string, { enrolled: boolean; ignored: boolean }> = {};
    for (const [id, state] of Object.entries(parsed.benefits ?? {})) {
      migratedBenefits[id] = {
        enrolled: state?.enrolled ?? false,
        ignored: state?.ignored ?? false,
      };
    }
    
    return {
      benefits: migratedBenefits,
      importNotes: parsed.importNotes ?? {},
      cardTransactions: parsed.cardTransactions ?? {},
    };
  } catch {
    return getDefaultData();
  }
}

function getSnapshot(): UserBenefitsData {
  if (cachedData === null) {
    cachedData = parseStoredData(localStorage.getItem(STORAGE_KEY));
  }
  return cachedData;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedData = null;
      callback();
    }
  };

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

function emitChange(): void {
  cachedData = null;
  for (const listener of listeners) {
    listener();
  }
}

// ===== Public API =====

/** React hook that subscribes to localStorage changes */
export function useUserBenefitsStore(): UserBenefitsData {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Save data to localStorage and notify subscribers */
export function saveUserBenefitsData(data: UserBenefitsData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  emitChange();
}

/** Get current data (non-reactive) */
export function getUserBenefitsData(): UserBenefitsData {
  return getSnapshot();
}

// ===== Benefit State =====

export function getDefaultUserState(benefit: BenefitDefinition): BenefitUserState {
  return {
    enrolled: !benefit.enrollmentRequired,
    ignored: false,
  };
}

export function updateUserState(
  benefitId: string,
  updates: Partial<BenefitUserState>
): BenefitUserState {
  const data = getUserBenefitsData();
  const existing = data.benefits[benefitId] ?? { enrolled: false, ignored: false };

  const updated: BenefitUserState = { ...existing, ...updates };
  data.benefits[benefitId] = updated;
  saveUserBenefitsData(data);

  return updated;
}

// ===== Import Notes =====

export function getImportNote(cardId: string): string {
  return getUserBenefitsData().importNotes?.[cardId] ?? '';
}

export function saveImportNote(cardId: string, note: string): void {
  const data = getUserBenefitsData();
  if (!data.importNotes) data.importNotes = {};
  data.importNotes[cardId] = note;
  saveUserBenefitsData(data);
}

// ===== Card Transactions =====

export function getCardTransactions(cardId: string): CardTransactionStore | null {
  return getUserBenefitsData().cardTransactions?.[cardId] ?? null;
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
