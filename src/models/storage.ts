import type {
  Benefit,
  BenefitDefinition,
  BenefitPeriod,
  BenefitPeriodDefinition,
  BenefitPeriodUserState,
  BenefitUserState,
  BenefitsStaticData,
  CreditCard,
  UserBenefitsData
} from '../models/types';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DATA_PATH = join(__dirname, '../../data/benefits.json');
const DEFAULT_USER_DATA_PATH = join(__dirname, '../../data/user-benefits.json');

function getStaticDataPath(): string {
  return process.env.BENEFITS_DATA_PATH ?? DEFAULT_STATIC_DATA_PATH;
}

function getUserDataPath(): string {
  return process.env.USER_BENEFITS_DATA_PATH ?? DEFAULT_USER_DATA_PATH;
}

function readStaticData(): BenefitsStaticData {
  try {
    const data = readFileSync(getStaticDataPath(), 'utf-8');
    return JSON.parse(data) as BenefitsStaticData;
  } catch {
    throw new Error('Failed to read benefits data');
  }
}

function readUserData(): UserBenefitsData {
  try {
    const data = readFileSync(getUserDataPath(), 'utf-8');
    const parsed = JSON.parse(data) as UserBenefitsData;
    return {
      benefits: parsed.benefits ?? {}
    };
  } catch {
    throw new Error('Failed to read user benefits data');
  }
}

function writeUserData(data: UserBenefitsData): void {
  writeFileSync(getUserDataPath(), JSON.stringify(data, null, 2));
}


function getDefaultUserState(benefit: BenefitDefinition): BenefitUserState {
  const periodStates = benefit.periods?.reduce<Record<string, BenefitPeriodUserState>>((acc, period) => {
    acc[period.id] = {
      usedAmount: 0,
      status: 'pending'
    };
    return acc;
  }, {});

  return {
    currentUsed: 0,
    activationAcknowledged: !benefit.activationRequired,
    notes: '',
    status: 'pending',
    ignored: false,
    periods: periodStates
  };
}

function mergePeriods(
  periods: BenefitPeriodDefinition[] | undefined,
  userPeriods: Record<string, BenefitPeriodUserState> | undefined
): BenefitPeriod[] | undefined {
  if (!periods?.length) {
    return undefined;
  }

  return periods.map(period => {
    const userPeriod = userPeriods?.[period.id];
    return {
      ...period,
      usedAmount: userPeriod?.usedAmount ?? 0,
      status: userPeriod?.status ?? 'pending'
    };
  });
}

function mergeBenefit(benefit: BenefitDefinition, userState?: BenefitUserState): Benefit {
  const resolvedUserState = userState ?? getDefaultUserState(benefit);

  return {
    ...benefit,
    ...resolvedUserState,
    periods: mergePeriods(benefit.periods, resolvedUserState.periods)
  };
}

export function getCards(): CreditCard[] {
  const data = readStaticData();
  return data.cards;
}

export function getCardById(id: string): CreditCard | undefined {
  const data = readStaticData();
  return data.cards.find(card => card.id === id);
}

export function getBenefits(cardId?: string, includeIgnored?: boolean): Benefit[] {
  const data = readStaticData();
  const userData = readUserData();
  const benefits = cardId
    ? data.benefits.filter(benefit => benefit.cardId === cardId)
    : data.benefits;
  const merged = benefits.map(benefit => mergeBenefit(benefit, userData.benefits[benefit.id]));

  if (includeIgnored) {
    return merged;
  }

  return merged.filter(benefit => !benefit.ignored);
}

export function getBenefitById(id: string): Benefit | undefined {
  const data = readStaticData();
  const userData = readUserData();
  const benefit = data.benefits.find(item => item.id === id);

  if (!benefit) {
    return undefined;
  }

  return mergeBenefit(benefit, userData.benefits[id]);
}

export function updateBenefit(id: string, updates: Partial<BenefitUserState>): Benefit {
  const data = readStaticData();
  const benefit = data.benefits.find(item => item.id === id);

  if (!benefit) {
    throw new Error('Benefit not found');
  }

  const userData = readUserData();
  const existingState = userData.benefits[id] ?? getDefaultUserState(benefit);
  const nextState: BenefitUserState = {
    ...existingState,
    ...updates,
    periods: existingState.periods
  };

  userData.benefits[id] = nextState;
  writeUserData(userData);

  return mergeBenefit(benefit, nextState);
}

export function updateBenefitPeriod(
  benefitId: string,
  periodId: string,
  updates: Partial<BenefitPeriodUserState>
): BenefitPeriod {
  const data = readStaticData();
  const benefit = data.benefits.find(item => item.id === benefitId);

  if (!benefit) {
    throw new Error('Benefit not found');
  }

  if (!benefit.periods) {
    throw new Error('Benefit has no periods');
  }

  const period = benefit.periods.find(item => item.id === periodId);

  if (!period) {
    throw new Error('Period not found');
  }

  const userData = readUserData();
  const existingState = userData.benefits[benefitId] ?? getDefaultUserState(benefit);
  const existingPeriods = existingState.periods ?? {};
  const currentPeriod = existingPeriods[periodId] ?? {
    usedAmount: 0,
    status: 'pending'
  };
  const nextPeriod = {
    ...currentPeriod,
    ...updates
  };

  const nextState: BenefitUserState = {
    ...existingState,
    periods: {
      ...existingPeriods,
      [periodId]: nextPeriod
    }
  };

  userData.benefits[benefitId] = nextState;
  writeUserData(userData);

  return {
    ...period,
    ...nextPeriod
  };
}

export function getUpcomingExpirations(days: number = 30, includeIgnored?: boolean): Benefit[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  let benefits = getBenefits(undefined, true).filter(benefit => {
    const endDate = new Date(benefit.endDate);
    return endDate > now && endDate <= cutoff && benefit.status === 'pending';
  });

  if (!includeIgnored) {
    benefits = benefits.filter(benefit => !benefit.ignored);
  }

  return benefits.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
}
