import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type MouseEvent,
  type KeyboardEvent,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import type { BenefitDefinition } from '@shared/types';
import type { ImportResult, CardType, ParsedTransaction } from '../types/import';
import { parseAmexCsv, extractAmexCredits } from '../services/amexParser';
import { matchCredits, aggregateCredits } from '../services/benefitMatcher';
import { getImportNote, saveImportNote } from '../storage/userBenefits';

interface ImportModalProps {
  isOpen: boolean;
  cardId: string;
  cardName: string;
  benefits: BenefitDefinition[];
  onClose: () => void;
  onImport: (
    aggregated: Map<
      string,
      {
        currentUsed: number;
        periods?: Record<string, { usedAmount: number; transactions?: { date: string; description: string; amount: number }[] }>;
        transactions?: { date: string; description: string; amount: number }[];
      }
    >
  ) => void;
}

type ImportStep = 'upload' | 'preview';

type ImportRowType = 'matched' | 'credit' | 'transaction';

interface DisplayRow {
  date: Date;
  description: string;
  benefitName: string | null;
  amount: number;
  rowType: ImportRowType;
}

export function ImportModal({
  isOpen,
  cardId,
  cardName,
  benefits,
  onClose,
  onImport,
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [allTransactions, setAllTransactions] = useState<ParsedTransaction[]>([]);
  const [importNote, setImportNote] = useState('');

  const resetState = useCallback(() => {
    setStep('upload');
    setError(null);
    setImportResult(null);
    setAllTransactions([]);
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isOpen && cardId) {
      setImportNote(getImportNote(cardId));
    }
  }, [isOpen, cardId]);

  const persistImportNote = useCallback(() => {
    if (!cardId) return;
    saveImportNote(cardId, importNote.trim());
  }, [cardId, importNote]);

  const handleClose = useCallback(() => {
    persistImportNote();
    resetState();
    onClose();
  }, [persistImportNote, onClose, resetState]);

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
        let allTransactions: ParsedTransaction[] = [];
        let credits: ParsedTransaction[] = [];
        if (cardId.startsWith('amex')) {
          allTransactions = parseAmexCsv(content);
          credits = extractAmexCredits(allTransactions);
        } else {
          // TODO: Add Chase parser
          setError('Chase import is not yet supported');
          return;
        }

        if (credits.length === 0) {
          setError(
            'No statement credits found in the CSV. Make sure you exported the correct file.'
          );
          return;
        }

        // Match credits to benefits
        const result = matchCredits(
          credits,
          cardId as CardType,
          benefits
        );

        setImportResult(result);
        setAllTransactions(allTransactions);
        setStep('preview');
      } catch (err) {
        setError(`Failed to parse CSV: ${(err as Error).message}`);
      }
    },
    [cardId, benefits]
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
    },
    [processFile]
  );

  const handleImport = useCallback(() => {
    if (!importResult) return;

    persistImportNote();

    // Aggregate all matched credits
    const aggregated = aggregateCredits(importResult.matchedCredits, benefits);

    onImport(aggregated);
    handleClose();
  }, [importResult, benefits, onImport, handleClose, persistImportNote]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  // Combine all transactions into a single display list with matching info
  const displayRows = useMemo((): DisplayRow[] => {
    if (!importResult) return [];

    // Build a set of credit transaction keys for quick lookup
    const creditKeys = new Set<string>();
    for (const credit of importResult.matchedCredits) {
      const key = `${credit.transaction.date.getTime()}-${credit.transaction.description}-${Math.abs(credit.transaction.amount)}`;
      creditKeys.add(key);
    }
    for (const credit of importResult.unmatchedCredits) {
      const key = `${credit.date.getTime()}-${credit.description}-${Math.abs(credit.amount)}`;
      creditKeys.add(key);
    }

    const rows: DisplayRow[] = [];

    // Add matched credits
    for (const credit of importResult.matchedCredits) {
      rows.push({
        date: credit.transaction.date,
        description: credit.transaction.extendedDetails ?? credit.transaction.description,
        benefitName: credit.benefitName,
        amount: credit.transaction.amount,
        rowType: 'matched',
      });
    }

    // Add unmatched credits
    for (const credit of importResult.unmatchedCredits) {
      rows.push({
        date: credit.date,
        description: credit.extendedDetails ?? credit.description,
        benefitName: null,
        amount: credit.amount,
        rowType: 'credit',
      });
    }

    // Add non-credit transactions (purchases, payments, etc.)
    for (const transaction of allTransactions) {
      const key = `${transaction.date.getTime()}-${transaction.description}-${Math.abs(transaction.amount)}`;
      if (!creditKeys.has(key)) {
        rows.push({
          date: transaction.date,
          description: transaction.extendedDetails ?? transaction.description,
          benefitName: null,
          amount: transaction.amount,
          rowType: 'transaction',
        });
      }
    }

    // Sort by date (newest first)
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [importResult, allTransactions]);

  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    const formatted = `$${Math.abs(amount).toFixed(2)}`;
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const totalMatchedAmount = importResult
    ? -importResult.matchedCredits.reduce((sum, c) => sum + c.creditAmount, 0)
    : 0;

  const totalCredits = importResult
    ? importResult.totalMatched + importResult.totalUnmatched
    : 0;

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="presentation"
      tabIndex={0}
    >
      <div
        className={`modal-content w-[90vw] ${step === 'preview' ? 'max-w-[900px]' : 'max-w-[560px]'}`}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-xl font-bold mb-4">
          Import {cardName} Statement
        </h2>

        {step === 'upload' && (
          <>
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
                <li>Click Download → CSV → All details</li>
                <li>Upload the downloaded file here</li>
              </ol>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={handleClose} className="btn-secondary">
                Close
              </button>
            </div>
          </>
        )}

        {step === 'preview' && importResult && (
          <>
            <p className="text-sm text-slate-400 mb-4">
              {importResult.totalMatched} of {totalCredits} credits matched
              {importResult.totalMatched > 0 && (
                <span className="text-emerald-400">
                  {' '}({formatAmount(totalMatchedAmount)} will be imported)
                </span>
              )}
            </p>

            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-800 sticky top-0">
                    <tr>
                      <th className="p-2 text-left whitespace-nowrap w-[120px]">Date</th>
                      <th className="p-2 text-left whitespace-nowrap">Description</th>
                      <th className="p-2 text-left whitespace-nowrap w-[220px]">Benefit</th>
                      <th className="p-2 text-right whitespace-nowrap w-[120px]">Amount</th>
                    </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr
                      key={`${row.date.getTime()}-${row.description}`}
                      className={`border-t border-slate-700 ${
                        row.rowType === 'matched'
                          ? 'hover:bg-slate-800/50'
                          : 'text-slate-500'
                      }`}
                    >
                      <td className={`p-2 whitespace-nowrap ${row.rowType === 'matched' ? 'text-slate-400' : ''}`}>
                        {formatDate(row.date)}
                      </td>
                      <td className={`p-2 whitespace-nowrap ${row.rowType === 'matched' ? 'text-slate-300' : ''}`}>
                        <div className="overflow-x-auto scrollbar-none">
                          {row.description}
                        </div>
                      </td>
                      <td className={`p-2 whitespace-nowrap ${row.rowType === 'matched' ? 'text-emerald-400' : ''}`}>
                        {row.benefitName ?? '—'}
                      </td>
                      <td className={`p-2 text-right whitespace-nowrap ${row.rowType === 'matched' ? 'text-emerald-400' : ''}`}>
                        {formatAmount(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                {importResult.totalMatched === 0 ? (
                  <span className="text-amber-400">No credits matched</span>
                ) : (
                  <>
                    <span className="text-emerald-400 font-medium">
                      {formatAmount(totalMatchedAmount)}
                    </span>
                    {' '}from {importResult.totalMatched} credits
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('upload')}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importResult.totalMatched === 0}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
