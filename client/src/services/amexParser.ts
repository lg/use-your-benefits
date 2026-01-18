// Amex-specific CSV parsing and credit extraction

import type { ParsedTransaction } from '../types/import';
import { parseCsv, parseDate, parseAmount } from './csvParser';

/**
 * Parse Amex CSV content into ParsedTransaction array
 */
export function parseAmexCsv(csvContent: string): ParsedTransaction[] {
  const rows = parseCsv(csvContent);

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr = row['Date'] ?? '';
    const date = parseDate(dateStr);
    if (!date) {
      continue;
    }

    const description = row['Description'] ?? '';
    const amount = parseAmount(row['Amount'] ?? '0');
    // Keep the original sign - negative amounts are credits in Amex CSVs

    transactions.push({
      date,
      description,
      amount,
      extendedDetails: row['Extended Details'],
      category: row['Category'],
      reference: row['Reference']?.replace(/'/g, ''),
    });
  }

  return transactions;
}

/**
 * Extract only credit transactions from Amex statement
 * Credits in Amex CSVs have negative amounts (they reduce your balance)
 * We exclude payments which are also negative
 */
export function extractAmexCredits(
  transactions: ParsedTransaction[]
): ParsedTransaction[] {
  return transactions.filter((t) => {
    // Credits are negative amounts
    if (t.amount >= 0) {
      return false;
    }

    const descLower = t.description.toLowerCase();
    const detailsLower = t.extendedDetails?.toLowerCase() ?? '';
    const combinedText = `${descLower} ${detailsLower}`.trim();

    // Exclude payment transactions (they're also negative but not credits)
    if (combinedText.includes('payment') || combinedText.includes('autopay')) {
      return false;
    }

    // It's a negative amount and not a payment, so it's a credit
    return true;
  });
}

/**
 * Convenience function to parse and extract credits in one step
 */
export function parseAmexCredits(csvContent: string): ParsedTransaction[] {
  const transactions = parseAmexCsv(csvContent);
  return extractAmexCredits(transactions);
}
