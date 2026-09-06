import {
  useState,
  useCallback,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import type { StoredTransaction, BenefitDefinition, CreditCard } from '@lib/types';
import { parseStatement, extractCredits, AMEX_CONFIG, CHASE_CONFIG } from '../../services/statementParser';
import { DownloadInstructions } from './DownloadInstructions';
import { TransactionTable } from './TransactionTable';

interface CardTransactionsTabProps {
  card: CreditCard;
  transactions: StoredTransaction[];
  definitions: BenefitDefinition[];
  onTransactionsUpdate: (transactions: StoredTransaction[]) => void;
}

export function CardTransactionsTab({
  card,
  transactions,
  definitions,
  onTransactionsUpdate,
}: CardTransactionsTabProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isChase = card.id.startsWith('chase');
  const isAmex = card.id.startsWith('amex');
  const cardLabel = isChase ? 'Chase' : 'Amex';

  const hasTransactions = transactions.length > 0;

  useEffect(() => {
    if (!hasTransactions) {
      setNotice(null);
    }
  }, [hasTransactions]);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setNotice(null);

      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }

      try {
        const content = await file.text();

        // Determine card type and config
        if (!isChase && !isAmex) {
          setError('This card is not yet supported for import');
          return;
        }

        const config = isChase ? CHASE_CONFIG : AMEX_CONFIG;
        const parsedTransactions = parseStatement(content, config);
        if (parsedTransactions.length === 0) {
          setError('No transactions could be read from this CSV. Make sure you exported account activity from the supported card.');
          return;
        }

        const credits = extractCredits(parsedTransactions, config);

        // Convert to StoredTransaction format
        // For Amex, extendedDetails has the full description; for Chase, use description directly
        // For Chase, extendedDetails contains the Type field (Sale, Adjustment, etc.)
        const storedTransactions: StoredTransaction[] = parsedTransactions.map(tx => ({
          date: tx.date.toISOString(),
          description: isAmex ? (tx.extendedDetails ?? tx.description) : tx.description,
          amount: tx.amount,
          type: isChase ? tx.extendedDetails : undefined,
        }));

        onTransactionsUpdate(storedTransactions);
        if (credits.length === 0) {
          setNotice('Imported successfully, but no statement credits were found in this CSV.');
        }
      } catch (err) {
        setError(`Failed to parse CSV: ${(err as Error).message}`);
      }
    },
    [isChase, isAmex, onTransactionsUpdate]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [processFile]
  );



  // Show upload UI when no transactions
  if (!hasTransactions) {
    return (
      <div className="py-4">
        {(isChase || isAmex) && (
          <DownloadInstructions key={card.id} bank={cardLabel} cardName={card.name} cardId={card.id} />
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          <div className="mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-12 w-12 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Database cylinder */}
              <ellipse cx="12" cy="14" rx="9" ry="3" />
              <path d="M3 14v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
              {/* Down arrow */}
              <path d="M12 1v10m0 0l-4-4M12 11l4-4" strokeWidth="2.5" />
            </svg>
          </div>
          <p className="text-slate-300 mb-2">
            Drag and drop your CSV file here
          </p>
          <p className="text-slate-500 text-sm mb-4">or</p>
          <label className="btn-primary cursor-pointer">
            Choose File
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}
        {notice && (
          <p className="mt-4 text-sm text-amber-300">{notice}</p>
        )}

        <p className="mt-4 text-center text-sm text-slate-400">
          Your CSV is processed entirely in your browser and is never sent to a server.
        </p>
      </div>
    );
  }

  // Show transactions view
  return (
    <div className="py-4">
      {notice && (
        <p className="mb-4 text-sm text-amber-300">{notice}</p>
      )}
      <TransactionTable
        transactions={transactions}
        cardId={card.id}
        definitions={definitions}
      />
    </div>
  );
}
