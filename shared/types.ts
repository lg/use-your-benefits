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
  type?: string; // Transaction type (e.g., "Adjustment", "Sale", "Return" for Chase)
}

// Period definition for runtime-generated periods
export interface BenefitPeriodDefinition {
  id: string;
  startDate: string;
  endDate: string;
}

// Full period with computed usage data
export interface BenefitPeriod extends BenefitPeriodDefinition {
  usedAmount: number;
  status: BenefitStatus;
  transactions?: StoredTransaction[];
  isCurrent?: boolean;
  timeProgress?: number;
  daysLeft?: number;
}

// User-specific state stored in localStorage
export interface BenefitUserState {
  enrolled: boolean;
  ignored: boolean;
}

export type ResetFrequency = 'annual' | 'twice-yearly' | 'quarterly' | 'monthly' | '4-year';

export interface BenefitDefinition {
  id: string;
  cardId: string;
  name: string;
  shortDescription: string;
  creditAmount: number;
  resetFrequency: ResetFrequency;
  enrollmentRequired: boolean;
}

// Full benefit with all computed fields (definition + user state + derived)
export type Benefit = BenefitDefinition &
  BenefitUserState & {
    currentUsed: number;
    status: BenefitStatus;
    startDate: string;  // Computed at runtime
    endDate: string;    // Computed at runtime
    periods?: BenefitPeriod[];
    transactions?: StoredTransaction[];
    card?: CreditCard;
    claimedElsewhereYear?: number;
    autoEnrolledAt?: string;
  };


export interface BenefitsStaticData {
  cards: CreditCard[];
  benefits: BenefitDefinition[];
}

export interface CardTransactionStore {
  transactions: StoredTransaction[];
  importedAt: string; // ISO date of last import
  // Pre-matched transactions by benefit ID (computed on import)
  matchedByBenefit?: Record<string, StoredTransaction[]>;
}

export interface UserBenefitsData {
  benefits: Record<string, BenefitUserState>;
  importNotes?: Record<string, string>;
  cardTransactions?: Record<string, CardTransactionStore>;
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



// Transaction status for card data imports
export interface TransactionStatus {
  dateRange: { min: Date; max: Date } | null;
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
  transactions?: StoredTransaction[];
  usedAmount?: number;
  segmentValue?: number;
  isMultiYear?: boolean; // True for 4-year benefits
}
