import {
  useState,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import type { StoredTransaction, BenefitDefinition, CreditCard } from '@shared/types';
import type { ParsedTransaction } from '../../types/import';
import { parseAmexCsv, extractAmexCredits } from '../../services/amexParser';
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

  const hasTransactions = transactions.length > 0;

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }

      try {
        const content = await file.text();

        // Parse based on card type
        let parsedTransactions: ParsedTransaction[] = [];
        if (card.id.startsWith('amex')) {
          parsedTransactions = parseAmexCsv(content);
          // Verify we got credits
          const credits = extractAmexCredits(parsedTransactions);
          if (credits.length === 0) {
            setError(
              'No statement credits found in the CSV. Make sure you exported the correct file.'
            );
            return;
          }
        } else {
          setError('Only Amex cards are currently supported for import');
          return;
        }

        // Convert to StoredTransaction format
        const storedTransactions: StoredTransaction[] = parsedTransactions.map(tx => ({
          date: tx.date.toISOString(),
          description: tx.extendedDetails ?? tx.description,
          amount: tx.amount,
        }));

        onTransactionsUpdate(storedTransactions);
      } catch (err) {
        setError(`Failed to parse CSV: ${(err as Error).message}`);
      }
    },
    [card.id, onTransactionsUpdate]
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
        <p className="text-sm text-slate-400 mb-4">
          Upload your Amex statement CSV to automatically import your
          benefit credits.
        </p>

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

        <div className="mt-6 text-xs text-slate-500">
          <p className="font-medium mb-1">How to export from Amex:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to transaction activity as far back as possible:{' '}
              <a
                href={`https://global.americanexpress.com/activity?endDate=${new Date().toISOString().split('T')[0]}&startDate=2024-01-01`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                global.americanexpress.com/activity
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="inline-block ml-0.5 h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </li>
            <li>Click Download → CSV (Include all additional transaction details) → Download</li>
            <li>Drag/upload the CSV above.</li>
          </ol>
        </div>

        <p className="mt-4 text-center text-sm text-white">
          Everything is done client-side and never uploaded anywhere!
        </p>
      </div>
    );
  }

  // Show transactions view
  return (
    <div className="py-4">
      <TransactionTable
        transactions={transactions}
        cardId={card.id}
        definitions={definitions}
      />
    </div>
  );
}
