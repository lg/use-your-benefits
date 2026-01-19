import { memo, useMemo } from 'react';
import type { StoredTransaction, BenefitDefinition } from '@shared/types';
import type { CardType, ParsedTransaction } from '../../types/import';
import { isBenefitCredit } from '@shared/utils';
import { matchCredits } from '../../services/benefitMatcher';
import { Tooltip } from '../Tooltip';

interface TransactionTableProps {
  transactions: StoredTransaction[];
  cardId: string;
  definitions: BenefitDefinition[];
}

interface DisplayTransaction {
  date: Date;
  description: string;
  amount: number;
  matchedBenefit: string | null;
  isCredit: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatAmount(amount: number): string {
  const absAmount = Math.abs(amount).toFixed(2);
  return amount < 0 ? `-$${absAmount}` : `$${absAmount}`;
}

function shortenBenefitName(name: string): string {
  if (name === 'Digital Entertainment') return 'Digital Ent';
  return name;
}

function TransactionTableComponent({
  transactions,
  cardId,
  definitions,
}: TransactionTableProps) {
  const displayTransactions = useMemo((): DisplayTransaction[] => {
    // Filter for benefit credits based on card type
    const credits: ParsedTransaction[] = transactions
      .filter(tx => isBenefitCredit(tx.amount, tx.description, cardId, tx.type))
      .map(tx => ({
        date: new Date(tx.date),
        description: tx.description,
        amount: tx.amount,
      }));

    // Run matcher to identify benefits
    const cardDefinitions = definitions.filter(d => d.cardId === cardId);
    const matchResult = matchCredits(credits, cardId as CardType, cardDefinitions);

    // Build a map of credit key -> benefit name
    const creditBenefitMap = new Map<string, string>();
    for (const matched of matchResult.matchedCredits) {
      const key = `${matched.transaction.date.getTime()}-${matched.transaction.description}-${matched.transaction.amount}`;
      creditBenefitMap.set(key, matched.benefitName ?? 'Unknown');
    }

    // Convert all transactions to display format
    return transactions
      .map(tx => {
        const date = new Date(tx.date);
        const txIsCredit = isBenefitCredit(tx.amount, tx.description, cardId, tx.type);
        const key = `${date.getTime()}-${tx.description}-${tx.amount}`;
        
        return {
          date,
          description: tx.description,
          amount: tx.amount,
          matchedBenefit: txIsCredit ? creditBenefitMap.get(key) ?? null : null,
          isCredit: txIsCredit,
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions, cardId, definitions]);

  if (displayTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No transactions to display
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[50vh] scrollbar-dark">
      <table className="w-full text-sm table-fixed">
        <thead className="sticky top-0 bg-slate-800 z-10">
          <tr className="text-left text-slate-400 border-b border-slate-700">
            <th className="py-2 px-4 font-medium w-[100px]">Date</th>
            <th className="py-2 px-4 font-medium">Description</th>
            <th className="py-2 pl-4 pr-0 font-medium w-[100px]">Benefit</th>
            <th className="py-2 px-4 font-medium text-right w-[105px]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {displayTransactions.map((tx, index) => (
            <tr
              key={`${tx.date.getTime()}-${tx.description}-${index}`}
              className={`border-b border-slate-700/50 ${
                tx.matchedBenefit 
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25' 
                  : 'hover:bg-slate-700/30'
              }`}
            >
              <td className={`py-2 px-4 whitespace-nowrap ${
                tx.matchedBenefit ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {formatDate(tx.date)}
              </td>
              <td
                className={`py-2 px-4 truncate ${
                  tx.matchedBenefit ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                <Tooltip content={tx.description}>
                  <span>{tx.description}</span>
                </Tooltip>
              </td>
              <td className={`py-2 pl-4 pr-0 truncate ${
                tx.matchedBenefit ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {tx.matchedBenefit ? (
                  <Tooltip content={tx.matchedBenefit}>
                    <span>{shortenBenefitName(tx.matchedBenefit)}</span>
                  </Tooltip>
                ) : tx.isCredit ? 'Unmatched credit' : '-'}
              </td>
              <td className={`py-2 px-4 text-right whitespace-nowrap font-mono ${
                tx.matchedBenefit ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {formatAmount(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const TransactionTable = memo(TransactionTableComponent);
