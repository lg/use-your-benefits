// Shared types used by both backend and frontend

export interface CreditCard {
  id: string;
  name: string;
  annualFee: number;
  resetBasis: 'calendar-year' | 'anniversary';
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
  usedAmount: number;
  status: BenefitStatus;
  transactions?: StoredTransaction[];
}

export interface BenefitPeriod extends BenefitPeriodDefinition, BenefitPeriodUserState {}

export interface BenefitDefinition {
  id: string;
  cardId: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  creditAmount: number;
  resetFrequency: 'annual' | 'twice-yearly' | 'quarterly' | 'monthly';
  activationRequired: boolean;
  startDate: string;
  endDate: string;
  category: string;
  periods?: BenefitPeriodDefinition[];
}

export interface BenefitUserState {
  currentUsed: number;
  activationAcknowledged: boolean;
  status: BenefitStatus;
  ignored: boolean;
  periods?: Record<string, BenefitPeriodUserState>;
  transactions?: StoredTransaction[];
}

export type Benefit = Omit<BenefitDefinition, 'periods'> &
  Omit<BenefitUserState, 'periods'> & {
    periods?: BenefitPeriod[];
    card?: CreditCard;
  };

export interface BenefitsStaticData {
  cards: CreditCard[];
  benefits: BenefitDefinition[];
}

export interface UserBenefitsData {
  benefits: Record<string, BenefitUserState>;
  importNotes?: Record<string, string>;
}

export interface UpdateBenefitRequest {
  status?: BenefitStatus;
  ignored?: boolean;
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
  status: 'pending' | 'completed' | 'missed' | 'future';
  label?: string;
  timeProgress?: number;
  startDate?: string;
  endDate?: string;
  daysLeft?: number;
  isCurrent?: boolean;
}
