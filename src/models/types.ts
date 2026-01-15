export interface CreditCard {
  id: string;
  name: string;
  annualFee: number;
  resetBasis: 'calendar-year' | 'anniversary';
  color: string;
}

export type BenefitStatus = 'pending' | 'completed' | 'missed';

export interface BenefitPeriodDefinition {
  id: string;
  startDate: string;
  endDate: string;
}

export interface BenefitPeriodUserState {
  usedAmount: number;
  status: BenefitStatus;
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
  notes: string;
  status: BenefitStatus;
  ignored: boolean;
  periods?: Record<string, BenefitPeriodUserState>;
}

export type Benefit = Omit<BenefitDefinition, 'periods'> &
  Omit<BenefitUserState, 'periods'> & {
    periods?: BenefitPeriod[];
  };

export interface BenefitsStaticData {
  cards: CreditCard[];
  benefits: BenefitDefinition[];
}

export interface UserBenefitsData {
  benefits: Record<string, BenefitUserState>;
}

export interface UpdateBenefitRequest {
  currentUsed?: number;
  notes?: string;
  status?: BenefitStatus;
  ignored?: boolean;
}

export interface UpdatePeriodRequest {
  usedAmount?: number;
  status?: BenefitStatus;
}
