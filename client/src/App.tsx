import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import type { CreditCard, Benefit, BenefitDefinition, Stats } from './types';
import { Dashboard } from './pages/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BenefitsProvider } from './context/BenefitsContext';
import * as benefitsService from './services/benefits';
import { api } from './api/client';
import { saveCardTransactions, getCardTransactionDateRange } from './storage/userBenefits';
import type { StoredTransaction } from '@shared/types';

const TransactionsModal = lazy(() => import('./components/TransactionsModal/TransactionsModal').then(m => ({ default: m.TransactionsModal })));

function App() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [definitions, setDefinitions] = useState<BenefitDefinition[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [allBenefits, setAllBenefits] = useState<Benefit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactionVersion, setTransactionVersion] = useState(0);

  const loadData = useCallback(async (signal?: AbortSignal, year?: number) => {
    try {
      // Fetch cards and definitions from static JSON
      const [cardsData, definitionsData] = await Promise.all([
        api.getCards(),
        api.getBenefitDefinitions(),
      ]);
      
      // Check if aborted before continuing
      if (signal?.aborted) return;
      
      // Fetch all benefits once, then filter for non-ignored
      const allBenefitsData = await benefitsService.getBenefits(undefined, true, year);
      const benefitsData = allBenefitsData.filter(b => !b.ignored);
      const statsData = await benefitsService.getStats(year);
      
      // Only update state if still mounted
      if (signal?.aborted) return;
      
      setCards(cardsData);
      setDefinitions(definitionsData);
      setBenefits(benefitsData);
      setAllBenefits(allBenefitsData);
      setStats(statsData);
    } catch (err) {
      if (signal?.aborted) return;
      setError((err as Error).message);
    } finally {
      // Data loaded
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal, selectedYear);
    return () => {
      controller.abort();
    };
  }, [loadData, selectedYear]);

  const handleToggleEnrollment = useCallback(async (id: string) => {
    const definition = definitions.find(d => d.id === id);
    if (!definition) {
      setUpdateError('Benefit not found');
      return;
    }

    const updated = await benefitsService.toggleEnrollment(id, definition, selectedYear);

    setAllBenefits(prev => prev.map(b => b.id === id ? updated : b));
    setBenefits(prev => prev.map(b => b.id === id ? updated : b));
    setUpdateError(null);
  }, [definitions, selectedYear]);

  const handleToggleVisibility = useCallback(async (id: string) => {
    const definition = definitions.find(d => d.id === id);
    if (!definition) {
      setUpdateError('Benefit not found');
      return;
    }

    const currentBenefit = allBenefits.find(b => b.id === id);
    const newIgnored = !currentBenefit?.ignored;

    const updated = await benefitsService.updateBenefit(id, definition, newIgnored, selectedYear);

    setAllBenefits(prev => prev.map(b => b.id === id ? updated : b));
    if (newIgnored) {
      setBenefits(prev => prev.filter(b => b.id !== id));
    } else {
      setBenefits(prev => {
        const exists = prev.find(b => b.id === id);
        if (exists) {
          return prev.map(b => b.id === id ? updated : b);
        }
        // Add and sort by definition order to maintain original position
        const newBenefits = [...prev, updated];
        return newBenefits.sort((a, b) => {
          const indexA = definitions.findIndex(d => d.id === a.id);
          const indexB = definitions.findIndex(d => d.id === b.id);
          return indexA - indexB;
        });
      });
    }

    const statsData = await benefitsService.getStats(selectedYear);
    setStats(statsData);
    setUpdateError(null);
  }, [definitions, allBenefits, selectedYear]);

  const handleTransactionsUpdate = useCallback(async (
    cardId: string,
    transactions: StoredTransaction[]
  ) => {
    // Save all transactions to card-level storage
    saveCardTransactions(cardId, transactions);
    
    // Bump version to trigger cardTransactionStatus recomputation
    setTransactionVersion(v => v + 1);
    
    // Refresh benefits from storage (transactions are now derived via matcher)
    // Auto-enrollment is derived in mergeBenefit based on detected credits
    const allBenefitsData = await benefitsService.getBenefits(undefined, true, selectedYear);
    const benefitsData = allBenefitsData.filter(b => !b.ignored);
    const statsData = await benefitsService.getStats(selectedYear);
    
    setAllBenefits(allBenefitsData);
    setBenefits(benefitsData);
    setStats(statsData);
    setUpdateError(null);
  }, [selectedYear]);

  // Build card transaction status for UI
  // transactionVersion triggers recomputation when transactions change
  const cardTransactionStatus = useMemo(() => {
    void transactionVersion; // Used to trigger recomputation
    const status: Record<string, { hasData: boolean; dateRange: { min: Date; max: Date } | null }> = {};
    for (const card of cards) {
      const dateRange = getCardTransactionDateRange(card.id);
      status[card.id] = {
        hasData: dateRange !== null,
        dateRange,
      };
    }
    return status;
  }, [cards, transactionVersion]);

  const handleClearError = useCallback(() => {
    setUpdateError(null);
  }, []);

  const handleRetry = useCallback(() => {
    loadData(undefined, selectedYear);
  }, [loadData, selectedYear]);

  const handleYearSelect = useCallback((year: number) => {
    if (year === selectedYear) return;
    const update = () => {
      setSelectedYear(year);
    };
    if (document.startViewTransition) {
      document.startViewTransition(update);
    } else {
      update();
    }
  }, [selectedYear]);
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <button onClick={handleRetry} className="btn-primary" type="button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const benefitsContextValue = useMemo(() => ({
    definitions,
    selectedYear,
    onToggleEnrollment: handleToggleEnrollment,
    onToggleVisibility: handleToggleVisibility,
  }), [definitions, selectedYear, handleToggleEnrollment, handleToggleVisibility]);

  return (
    <div className="min-h-screen bg-slate-900">
      {updateError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span>{updateError}</span>
          <button 
            onClick={handleClearError}
            className="text-white hover:text-red-200"
            type="button"
          >
            ✕
          </button>
        </div>
      )}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-bold text-xl text-white">
                Use Your Benefits
              </h1>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                  {[2024, 2025, 2026].map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedYear === year
                          ? 'bg-slate-200 text-slate-900'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      type="button"
                    >
                      {year}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setTransactionsModalOpen(true)}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title="Transactions"
                  type="button"
                >
                  {/* Database with down arrow icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Database cylinder - pushed down, drawn first so arrow is on top */}
                    <ellipse cx="12" cy="14" rx="9" ry="3" />
                    <path d="M3 14v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
                    {/* Big down arrow on top - drawn last so it's in front */}
                    <path d="M12 1v10m0 0l-4-4M12 11l4-4" strokeWidth="2.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <BenefitsProvider
          value={benefitsContextValue}
        >
          <ErrorBoundary>
            <Dashboard
              benefits={benefits}
              cards={cards}
              allBenefits={allBenefits}
              stats={stats}
              cardTransactionStatus={cardTransactionStatus}
              onOpenTransactions={() => setTransactionsModalOpen(true)}
            />
          </ErrorBoundary>
        </BenefitsProvider>
      </main>

      <Suspense fallback={null}>
        <TransactionsModal
          isOpen={transactionsModalOpen}
          cards={cards}
          definitions={definitions}
          onClose={() => setTransactionsModalOpen(false)}
          onTransactionsUpdate={handleTransactionsUpdate}
        />
      </Suspense>
    </div>
  );
}

export default App;
