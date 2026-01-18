import { useState, useCallback, useEffect } from 'react';
import type { CreditCard, Benefit, BenefitDefinition, Stats } from './types';
import { Dashboard } from './pages/Dashboard';
import { CardDetail } from './pages/CardDetail';
import { ErrorBoundary } from './components/ErrorBoundary';
import * as benefitsService from './services/benefits';
import { api } from './api/client';
import { importBenefitUsage } from './storage/userBenefits';

function App() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [definitions, setDefinitions] = useState<BenefitDefinition[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [allBenefits, setAllBenefits] = useState<Benefit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  const loadAllBenefitsForCard = useCallback(async (cardId: string, signal?: AbortSignal, year?: number) => {
    const allBenefitsData = await benefitsService.getBenefits(cardId, true, year);
    if (signal?.aborted) return;
    setAllBenefits(prev => {
      const otherBenefits = prev.filter(b => b.cardId !== cardId);
      return [...otherBenefits, ...allBenefitsData];
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal, selectedYear);
    return () => {
      controller.abort();
    };
  }, [loadData, selectedYear]);
  
  useEffect(() => {
    if (selectedCardId) {
      const controller = new AbortController();
      loadAllBenefitsForCard(selectedCardId, controller.signal, selectedYear);
      return () => {
        controller.abort();
      };
    }
  }, [selectedCardId, loadAllBenefitsForCard, selectedYear]);

  const handleToggleEnrollment = useCallback((id: string) => {
    const definition = definitions.find(d => d.id === id);
    if (!definition) {
      setUpdateError('Benefit not found');
      return;
    }

    const updated = benefitsService.toggleEnrollment(id, definition, selectedYear);

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

    const updated = benefitsService.updateBenefit(id, definition, newIgnored, selectedYear);

    setAllBenefits(prev => prev.map(b => b.id === id ? updated : b));
    if (newIgnored) {
      setBenefits(prev => prev.filter(b => b.id !== id));
    } else {
      setBenefits(prev => {
        const exists = prev.find(b => b.id === id);
        if (exists) {
          return prev.map(b => b.id === id ? updated : b);
        }
        return [...prev, updated];
      });
    }

    const statsData = await benefitsService.getStats(selectedYear);
    setStats(statsData);
    setUpdateError(null);
  }, [definitions, allBenefits, selectedYear]);

  const handleImport = useCallback(async (
    cardId: string,
    aggregated: Map<string, {
      currentUsed: number;
      periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>;
      transactions?: { date: string; description: string; amount: number }[];
    }>
  ) => {
    // Get definitions for this card
    const cardDefinitions = definitions.filter(d => d.cardId === cardId);
    
    // Import to localStorage
    importBenefitUsage(aggregated, cardDefinitions);
    
    // Refresh benefits from storage
    const allBenefitsData = await benefitsService.getBenefits(undefined, true, selectedYear);
    const benefitsData = allBenefitsData.filter(b => !b.ignored);
    const statsData = await benefitsService.getStats(selectedYear);
    
    setAllBenefits(allBenefitsData);
    setBenefits(benefitsData);
    setStats(statsData);
    setUpdateError(null);
  }, [definitions, selectedYear]);

  const handleClearError = useCallback(() => {
    setUpdateError(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCardId(null);
  }, []);

  const handleRetry = useCallback(() => {
    loadData(undefined, selectedYear);
  }, [loadData, selectedYear]);

  const handleCardSelect = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
  }, []);

  const handleYearSelect = useCallback((year: number) => {
    if (year === selectedYear) return;
    const update = () => {
      setSelectedYear(year);
      setSelectedCardId(null);
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

  const selectedCard = selectedCardId ? cards.find(c => c.id === selectedCardId) : null;
  const selectedCardBenefits = selectedCardId 
    ? benefits.filter(b => b.cardId === selectedCardId)
    : [];
  const selectedCardAllBenefits = selectedCardId
    ? allBenefits.filter(b => b.cardId === selectedCardId)
    : [];

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
              <button
                onClick={handleBack}
                className={`font-bold text-xl ${!selectedCardId ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                type="button"
              >
                Use Your Benefits
              </button>
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
              </div>
            </div>
            <nav className="flex flex-wrap gap-2">
              <button
                onClick={handleBack}
                className={`px-3 py-1 rounded ${
                  !selectedCardId ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                type="button"
              >
                All Cards
              </button>
              {cards.map(card => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelect(card.id)}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    selectedCardId === card.id ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  style={{ 
                    backgroundColor: selectedCardId === card.id ? card.color : undefined 
                  }}
                  type="button"
                >
                  {card.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <ErrorBoundary>
          {selectedCard ? (
              <CardDetail
                card={selectedCard}
                benefits={selectedCardBenefits}
                allBenefits={selectedCardAllBenefits}
                definitions={definitions.filter(d => d.cardId === selectedCardId)}
                selectedYear={selectedYear}
                onBack={handleBack}
                onToggleEnrollment={handleToggleEnrollment}
                onToggleVisibility={handleToggleVisibility}
                onImport={handleImport}
              />

          ) : (
            <Dashboard
              benefits={benefits}
              cards={cards}
              allBenefits={allBenefits}
              definitions={definitions}
              stats={stats}
              selectedYear={selectedYear}
              onToggleEnrollment={handleToggleEnrollment}
              onToggleVisibility={handleToggleVisibility}
              onImport={handleImport}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
