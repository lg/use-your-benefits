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
      acc[period.id] = {
        usedAmount: 0,
        status: 'pending',
      };
      return acc;
    },
    {}
  );

  return {
    currentUsed: 0,
    activationAcknowledged: !benefit.activationRequired,
    status: 'pending',
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
    currentUsed: 0,
    activationAcknowledged: false,
    status: 'pending' as const,
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
  imports: Map<string, { currentUsed: number; periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>; transactions?: { date: string; description: string; amount: number }[] }>,
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

    // Replace currentUsed (not add)
    existing.currentUsed = usage.currentUsed;

    // Handle period-based updates
    if (usage.periods && benefitDef.periods) {
      existing.periods = existing.periods ?? {};

      for (const [periodId, periodData] of Object.entries(usage.periods)) {
        // Calculate status based on period's max amount
        const periodCount = benefitDef.periods.length;
        const maxPerPeriod = benefitDef.creditAmount / periodCount;
        const periodStatus: BenefitPeriodUserState['status'] =
          periodData.usedAmount >= maxPerPeriod ? 'completed' : 'pending';

        existing.periods[periodId] = {
          usedAmount: periodData.usedAmount,
          status: periodStatus,
          transactions: periodData.transactions,
        };
      }
    }

    // Handle non-period benefit transactions
    if (usage.transactions && (!benefitDef.periods || benefitDef.periods.length === 0)) {
      existing.transactions = usage.transactions;
    }

    // Recalculate overall status
    existing.status = calculateBenefitStatus(existing, benefitDef);

    data.benefits[benefitId] = existing;
  }

  saveUserBenefitsData(data);
}

function calculateBenefitStatus(
  state: BenefitUserState,
  definition: BenefitDefinition
): BenefitUserState['status'] {
  // If benefit has periods, check if all periods are completed
  if (state.periods && definition.periods && definition.periods.length > 0) {
    const allCompleted = definition.periods.every((period) => {
      const periodState = state.periods?.[period.id];
      return periodState?.status === 'completed';
    });

    if (allCompleted) {
      return 'completed';
    }

    // Check if any periods are missed (past end date and not completed)
    const now = new Date();
    const anyMissed = definition.periods.some((period) => {
      const endDate = new Date(period.endDate);
      const periodState = state.periods?.[period.id];
      return endDate < now && periodState?.status !== 'completed';
    });

    if (anyMissed) {
      return 'missed';
    }

    return 'pending';
  }

  // Non-period benefit: check total usage
  if (state.currentUsed >= definition.creditAmount) {
    return 'completed';
  }

  // Check if benefit end date has passed
  const endDate = new Date(definition.endDate);
  if (endDate < new Date() && state.currentUsed < definition.creditAmount) {
    return 'missed';
  }

  return 'pending';
}
