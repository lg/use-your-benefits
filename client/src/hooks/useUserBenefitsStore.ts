import { useSyncExternalStore } from 'react';
import type { UserBenefitsData } from '@shared/types';

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
    const parsed = JSON.parse(stored) as UserBenefitsData;
    
    // Migration: strip old transaction data from benefit states
    // Users must re-upload CSV to populate cardTransactions
    const migratedBenefits: Record<string, typeof parsed.benefits[string]> = {};
    for (const [id, state] of Object.entries(parsed.benefits ?? {})) {
      const { transactions: _transactions, periods, ...rest } = state;
      // Strip transactions from periods too
      const cleanedPeriods = periods
        ? Object.fromEntries(
            Object.entries(periods).map(([pid, pstate]) => {
              const { transactions: _ptx, ...prest } = pstate;
              return [pid, prest];
            })
          )
        : undefined;
      migratedBenefits[id] = { ...rest, periods: cleanedPeriods };
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

  // Listen for storage events from other tabs/windows
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedData = null; // Invalidate cache
      callback();
    }
  };

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

/**
 * Notify all subscribers that the store has changed.
 * Call this after saving to localStorage.
 */
export function emitChange(): void {
  cachedData = null; // Invalidate cache
  for (const listener of listeners) {
    listener();
  }
}

/**
 * React hook that subscribes to localStorage changes using useSyncExternalStore.
 * Automatically updates when localStorage is modified (including from other tabs).
 */
export function useUserBenefitsStore(): UserBenefitsData {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Save data to localStorage and notify all subscribers.
 */
export function saveUserBenefitsData(data: UserBenefitsData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  emitChange();
}

/**
 * Get the current data from the store (non-reactive).
 * Prefer useUserBenefitsStore() for reactive access in components.
 */
export function getUserBenefitsData(): UserBenefitsData {
  return getSnapshot();
}
