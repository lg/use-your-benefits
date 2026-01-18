import {
  useState,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import type { StoredTransaction, BenefitDefinition, CreditCard } from '@shared/types';
import type { ParsedTransaction } from '../../types/import';
import { parseAmexCsv, extractAmexCredits } from '../../services/amexParser';
import { getImportNote, saveImportNote } from '../../storage/userBenefits';
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
  const [importNote, setImportNote] = useState(() => getImportNote(card.id));

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

  const persistImportNote = useCallback(() => {
    saveImportNote(card.id, importNote.trim());
  }, [card.id, importNote]);

  // Show upload UI when no transactions
  if (!hasTransactions) {
    return (
      <div className="py-4">
        <p className="text-sm text-slate-400 mb-4">
          Upload your Amex statement CSV to automatically import your
          benefit credits. Nothing gets uploaded to any server; it stays in
          your browser.
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
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
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

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="import-notes">
            Download link or notes
          </label>
          <textarea
            id="import-notes"
            className="w-full rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            rows={3}
            value={importNote}
            onChange={(event) => setImportNote(event.target.value)}
            onBlur={persistImportNote}
            placeholder="Paste the Amex download URL or add notes for later"
          />
          <p className="mt-2 text-xs text-slate-500">
            Saved locally for this card.
          </p>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          <p className="font-medium mb-1">How to export from Amex:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to https://global.americanexpress.com/activity?year=2026</li>
            <li>Click Download -&gt; CSV -&gt; All details</li>
            <li>Upload the downloaded file here</li>
          </ol>
        </div>
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
