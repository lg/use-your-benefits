import React from 'react';
import { CreditCard, Benefit, Stats } from './types';
import { Dashboard } from './pages/Dashboard';
import { CardDetail } from './pages/CardDetail';
import { api } from './api/client';

function App() {
  const [cards, setCards] = React.useState<CreditCard[]>([]);
  const [benefits, setBenefits] = React.useState<Benefit[]>([]);
  const [allBenefits, setAllBenefits] = React.useState<Benefit[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [cardsData, benefitsData, allBenefitsData, statsData] = await Promise.all([
        api.getCards(),
        api.getBenefits(),
        api.getBenefits(undefined, true),
        api.getStats(),
      ]);
      setCards(cardsData);
      setBenefits(benefitsData);
      setAllBenefits(allBenefitsData);
      setStats(statsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllBenefitsForCard = React.useCallback(async (cardId: string) => {
    const allBenefitsData = await api.getBenefits(cardId, true);
    setAllBenefits(prev => {
      const otherBenefits = prev.filter(b => b.cardId !== cardId);
      return [...otherBenefits, ...allBenefitsData];
    });
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (selectedCardId) {
      loadAllBenefitsForCard(selectedCardId);
    }
  }, [selectedCardId, loadAllBenefitsForCard]);

  const handleUpdateBenefit = async (id: string, data: { currentUsed: number; notes: string }) => {
    try {
      const updated = await api.updateBenefit(id, data);
      setBenefits(prev => prev.map(b => b.id === id ? updated : b));
      setAllBenefits(prev => prev.map(b => b.id === id ? updated : b));
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to update benefit:', err);
    }
  };

  const handleToggleActivation = async (id: string) => {
    try {
      const updated = await api.toggleActivation(id);
      setBenefits(prev => prev.map(b => b.id === id ? updated : b));
      setAllBenefits(prev => prev.map(b => b.id === id ? updated : b));
    } catch (err) {
      console.error('Failed to toggle activation:', err);
    }
  };

  const handleToggleIgnored = async (id: string, data: { ignored: boolean }) => {
    try {
      await api.updateBenefit(id, data);
      setAllBenefits(prev => prev.map(b => b.id === id ? { ...b, ignored: data.ignored } : b));
      const [benefitsData, statsData] = await Promise.all([
        api.getBenefits(),
        api.getStats(),
      ]);
      setBenefits(benefitsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to toggle ignored:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading benefits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <button onClick={loadData} className="btn-primary">
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
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedCardId(null)}
                className={`font-bold text-xl ${!selectedCardId ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                💳 Credit Card Benefits
              </button>
            </div>
            <nav className="flex gap-2">
              <button
                onClick={() => setSelectedCardId(null)}
                className={`px-3 py-1 rounded ${
                  !selectedCardId ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Cards
              </button>
              {cards.map(card => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    selectedCardId === card.id ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  style={{ 
                    backgroundColor: selectedCardId === card.id ? card.color : undefined 
                  }}
                >
                  {card.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {selectedCard ? (
          <CardDetail
            card={selectedCard}
            benefits={selectedCardBenefits}
            allBenefits={selectedCardAllBenefits}
            onBack={() => setSelectedCardId(null)}
            onEditBenefit={() => {}}
            onUpdateBenefit={handleUpdateBenefit}
            onToggleActivation={handleToggleActivation}
            onToggleIgnored={handleToggleIgnored}
          />
        ) : (
          <Dashboard
            benefits={benefits}
            cards={cards}
            allBenefits={allBenefits}
            stats={stats}
            onEditBenefit={() => {}}
            onUpdateBenefit={handleUpdateBenefit}
            onToggleActivation={handleToggleActivation}
            onToggleIgnored={handleToggleIgnored}
          />
        )}
      </main>
    </div>
  );
}

export default App;
