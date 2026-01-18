// Shared types used by both backend and frontend

export interface CreditCard {
  id: string;
  name: string;
  annualFeeByYear: Record<string, number>;
  color: string;
}

export type BenefitStatus = 'pending' | 'completed' | 'missed';

export interface StoredTransaction {
  date: string;
  description: string;
  amount: number;
}

export interface BenefitPeriodDefinition {
  id: string;
  startDate: string;
  endDate: string;
}

export interface BenefitPeriodUserState {
  transactions?: StoredTransaction[];
}

export interface BenefitPeriod extends BenefitPeriodDefinition {
  usedAmount: number;
  status: BenefitStatus;
  transactions?: StoredTransaction[];
  isCurrent?: boolean;
  timeProgress?: number;
  daysLeft?: number;
}

export interface BenefitUserState {
  enrolled: boolean;
  ignored: boolean;
  periods?: Record<string, BenefitPeriodUserState>;
  transactions?: StoredTransaction[];
}

export interface BenefitDerivedFields {
  currentUsed: number;
  status: BenefitStatus;
}

export interface BenefitDefinition {
  id: string;
  cardId: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  creditAmount: number;
  resetFrequency: 'annual' | 'twice-yearly' | 'quarterly' | 'monthly';
  enrollmentRequired: boolean;
  startDate: string;
  endDate: string;
  category: string;
  periods?: BenefitPeriodDefinition[];
}

export type Benefit = Omit<BenefitDefinition, 'periods'> &
  BenefitUserState &
  BenefitDerivedFields & {
    periods?: BenefitPeriod[];
    card?: CreditCard;
    claimedElsewhereYear?: number;
  };


export interface BenefitsStaticData {
  cards: CreditCard[];
  benefits: BenefitDefinition[];
}

export interface UserBenefitsData {
  benefits: Record<string, BenefitUserState>;
  importNotes?: Record<string, string>;
}


export interface Stats {
  totalBenefits: number;
  totalValue: number;
  usedValue: number;
  currentPeriodCompletedCount: number;
  ytdCompletedPeriods: number;
  ytdTotalPeriods: number;
  pendingCount: number;
  missedCount: number;
}

export interface CardStats {
  totalBenefits: number;
  totalValue: number;
  usedValue: number;
  currentPeriodCompletedCount: number;
  ytdCompletedPeriods: number;
  ytdTotalPeriods: number;
  pendingCount: number;
  missedCount: number;
}

// Progress segment type used by UI components
export interface ProgressSegment {
  id: string;
  status: 'pending' | 'completed' | 'missed';
  label?: string;
  timeProgress?: number;
  startDate?: string;
  endDate?: string;
  daysLeft?: number;
  isCurrent?: boolean;
}
