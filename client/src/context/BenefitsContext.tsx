import { createContext, useContext, type ReactNode } from 'react';
import type { BenefitDefinition } from '@shared/types';

interface BenefitsContextValue {
  definitions: BenefitDefinition[];
  selectedYear: number;
  onToggleEnrollment: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

const BenefitsContext = createContext<BenefitsContextValue | null>(null);

interface BenefitsProviderProps {
  children: ReactNode;
  value: BenefitsContextValue;
}

export function BenefitsProvider({ children, value }: BenefitsProviderProps) {
  return (
    <BenefitsContext.Provider value={value}>
      {children}
    </BenefitsContext.Provider>
  );
}

export function useBenefits(): BenefitsContextValue {
  const context = useContext(BenefitsContext);
  if (!context) {
    throw new Error('useBenefits must be used within a BenefitsProvider');
  }
  return context;
}
