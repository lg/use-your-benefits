import type {
  BenefitDefinition,
  BenefitPeriodUserState,
  BenefitUserState,
  UserBenefitsData,
} from '../../../shared/types';

const STORAGE_KEY = 'use-your-benefits';

// Module-level cache for localStorage reads
let cachedData: UserBenefitsData | null = null;

export function getUserBenefitsData(): UserBenefitsData {
  // Return cached data if available
  if (cachedData !== null) {
    return cachedData;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      cachedData = { benefits: {}, importNotes: {} };
      return cachedData;
    }
    const parsed = JSON.parse(stored) as UserBenefitsData;
    cachedData = {
      benefits: parsed.benefits ?? {},
      importNotes: parsed.importNotes ?? {},
    };
    return cachedData;
  } catch {
    cachedData = { benefits: {}, importNotes: {} };
    return cachedData;
  }
}

export function saveUserBenefitsData(data: UserBenefitsData): void {
  // Update cache when saving
  cachedData = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

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

export function importBenefitUsage(
  imports: Map<string, { periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>; transactions?: { date: string; description: string; amount: number }[] }>,
  benefitDefinitions: BenefitDefinition[]
): void {
  const data = getUserBenefitsData();

  // Create lookup for benefit definitions
  const benefitDefMap = new Map<string, BenefitDefinition>();
  for (const def of benefitDefinitions) {
    benefitDefMap.set(def.id, def);
  }

  for (const [benefitId, usage] of imports) {
    const benefitDef = benefitDefMap.get(benefitId);
    if (!benefitDef) continue;

    // Get existing state or create default
    const existing = data.benefits[benefitId] ?? getDefaultUserState(benefitDef);

    const periodTransactions = usage.periods
      ? Object.values(usage.periods).flatMap((period) => period.transactions ?? [])
      : [];

    const mergedTransactions = [...(usage.transactions ?? []), ...periodTransactions];

    if (mergedTransactions.length > 0) {
      existing.transactions = mergedTransactions;
    }

    if (usage.periods) {
      existing.periods = Object.fromEntries(
        Object.entries(usage.periods).map(([periodId, periodUsage]) => [
          periodId,
          { transactions: periodUsage.transactions ?? [] },
        ])
      );
    }

    data.benefits[benefitId] = existing;
  }

  saveUserBenefitsData(data);
}
