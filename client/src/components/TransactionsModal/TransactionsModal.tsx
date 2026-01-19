import {
  useState,
  useCallback,
  useMemo,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import type { CreditCard, BenefitDefinition, StoredTransaction } from '@shared/types';
import { getCardTransactions, clearCardTransactions } from '../../storage/userBenefits';
import { formatDateRange } from '@shared/utils';
import { CardTransactionsTab } from './CardTransactionsTab';

type ConfirmState = 'none' | 'confirming';

interface TransactionsModalProps {
  isOpen: boolean;
  cards: CreditCard[];
  definitions: BenefitDefinition[];
  onClose: () => void;
  onTransactionsUpdate: (cardId: string, transactions: StoredTransaction[]) => void;
}

export function TransactionsModal({
  isOpen,
  cards,
  definitions,
  onClose,
  onTransactionsUpdate,
}: TransactionsModalProps) {
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.id ?? '');
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmState>('none');

  // Get transaction data for all cards
  // refreshKey forces recomputation when transactions are updated
  const cardData = useMemo(() => {
    // Use refreshKey to trigger recomputation
    void refreshKey;
    
    const data: Record<string, {
      transactions: StoredTransaction[];
      dateRange: { min: Date; max: Date } | null;
    }> = {};

    for (const card of cards) {
      const store = getCardTransactions(card.id);
      if (store && store.transactions.length > 0) {
        const dates = store.transactions.map(t => new Date(t.date));
        data[card.id] = {
          transactions: store.transactions,
          dateRange: {
            min: new Date(Math.min(...dates.map(d => d.getTime()))),
            max: new Date(Math.max(...dates.map(d => d.getTime()))),
          },
        };
      } else {
        data[card.id] = { transactions: [], dateRange: null };
      }
    }

    return data;
  }, [cards, refreshKey]);

  const selectedCard = cards.find(c => c.id === selectedCardId);
  const selectedCardData = cardData[selectedCardId] ?? { transactions: [], dateRange: null };

  const handleOverlayClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleOverlayKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const handleTransactionsUpdate = useCallback((transactions: StoredTransaction[]) => {
    onTransactionsUpdate(selectedCardId, transactions);
    setRefreshKey(k => k + 1);
  }, [selectedCardId, onTransactionsUpdate]);

  const handleClearTransactions = useCallback(() => {
    clearCardTransactions(selectedCardId);
    onTransactionsUpdate(selectedCardId, []);
    setRefreshKey(k => k + 1);
    setConfirmState('none');
  }, [selectedCardId, onTransactionsUpdate]);

  const handleDeleteClick = useCallback(() => {
    setConfirmState('confirming');
  }, []);

  const handleCancelDelete = useCallback(() => {
    setConfirmState('none');
  }, []);

  const selectedHasData = selectedCardData.transactions.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="presentation"
      tabIndex={0}
    >
      <div
        className="modal-content w-[90vw] max-w-[800px] max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Transactions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Card Tabs */}
        <div className="flex gap-1 border-b border-slate-700 mb-4">
          {cards.map(card => {
            const data = cardData[card.id];
            const hasData = data?.dateRange !== null;
            const isSelected = card.id === selectedCardId;

            return (
              <button
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isSelected
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {/* Status icon */}
                {hasData ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}

                {/* Card name */}
                <span>{card.name}</span>

                {/* Date range badge */}
                {hasData && data?.dateRange && (
                  <span className="text-xs text-slate-500">
                    ({formatDateRange(data.dateRange.min, data.dateRange.max)})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {selectedCard && (
            <CardTransactionsTab
              card={selectedCard}
              transactions={selectedCardData.transactions}
              definitions={definitions}
              onTransactionsUpdate={handleTransactionsUpdate}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            {selectedHasData && confirmState === 'none' && (
              <button
                onClick={handleDeleteClick}
                className="flex items-center justify-center w-8 h-8 rounded border border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-400/50 transition-colors"
                aria-label="Delete transaction data"
                title="Delete transaction data"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            {confirmState === 'confirming' && (
              <>
                <span className="text-sm text-slate-300">Delete transaction data?</span>
                <button
                  onClick={handleClearTransactions}
                  className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="px-3 py-1.5 text-sm rounded border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded text-white transition-colors ${
              selectedHasData
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
