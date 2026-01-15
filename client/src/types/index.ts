export interface CreditCard {
  id: string;
  name: string;
  annualFee: number;
  resetBasis: 'calendar-year' | 'anniversary';
  color: string;
}

export type BenefitStatus = 'pending' | 'completed' | 'missed';

export interface BenefitPeriod {
  id: string;
  startDate: string;
  endDate: string;
  usedAmount: number;
  status: BenefitStatus;
}

export interface Benefit {
  id: string;
  cardId: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  creditAmount: number;
  currentUsed: number;
  resetFrequency: 'annual' | 'twice-yearly' | 'quarterly' | 'monthly';
  activationRequired: boolean;
  activationAcknowledged: boolean;
  startDate: string;
  endDate: string;
  notes: string;
  status: BenefitStatus;
  category: string;
  periods?: BenefitPeriod[];
  card?: CreditCard;
  ignored: boolean;
}

export interface BenefitWithCard extends Benefit {
  card: CreditCard;
}

export interface Stats {
  totalBenefits: number;
  totalValue: number;
  usedValue: number;
  completedCount: number;
  pendingCount: number;
  missedCount: number;
}

export interface UpdateBenefitRequest {
  currentUsed?: number;
  notes?: string;
  status?: BenefitStatus;
  ignored?: boolean;
}
