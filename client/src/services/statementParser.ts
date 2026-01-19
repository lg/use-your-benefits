import type { ParsedTransaction } from '../types/import';
import { parseCsv, parseDate, parseAmount } from './csvParser';

interface StatementConfig {
  cardId: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  extendedDetailsColumn?: string;
  categoryColumn?: string;
  referenceColumn?: string;
  decodeHtml?: boolean;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export const CHASE_CONFIG: StatementConfig = {
  cardId: 'chase',
  dateColumn: 'Transaction Date',
  descriptionColumn: 'Description',
  amountColumn: 'Amount',
  extendedDetailsColumn: 'Type',
  categoryColumn: 'Category',
  decodeHtml: true,
};

export const AMEX_CONFIG: StatementConfig = {
  cardId: 'amex',
  dateColumn: 'Date',
  descriptionColumn: 'Description',
  amountColumn: 'Amount',
  extendedDetailsColumn: 'Extended Details',
  categoryColumn: 'Category',
  referenceColumn: 'Reference',
};

export function parseStatement(csvContent: string, config: StatementConfig): ParsedTransaction[] {
  const rows = parseCsv(csvContent);

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr = row[config.dateColumn] ?? '';
    const date = parseDate(dateStr);
    if (!date) {
      continue;
    }

    let description = row[config.descriptionColumn] ?? '';
    if (config.decodeHtml) {
      description = decodeHtmlEntities(description);
    }
    const amount = parseAmount(row[config.amountColumn] ?? '0');

    transactions.push({
      date,
      description,
      amount,
      extendedDetails: config.extendedDetailsColumn ? row[config.extendedDetailsColumn] : undefined,
      category: config.categoryColumn ? row[config.categoryColumn] : undefined,
      reference: config.referenceColumn ? row[config.referenceColumn]?.replace(/'/g, '') : undefined,
    });
  }

  return transactions;
}

export function extractCredits(
  transactions: ParsedTransaction[],
  config: StatementConfig
): ParsedTransaction[] {
  return transactions.filter((t) => {
    if (config.cardId === 'chase') {
      if (t.amount <= 0) return false;
      const type = t.extendedDetails?.toLowerCase() ?? '';
      if (type === 'payment') return false;
      if (type === 'return') return false;
      return true;
    }

    if (config.cardId === 'amex') {
      if (t.amount >= 0) return false;
      const descLower = t.description.toLowerCase();
      const detailsLower = t.extendedDetails?.toLowerCase() ?? '';
      const combinedText = `${descLower} ${detailsLower}`.trim();
      if (combinedText.includes('payment') || combinedText.includes('autopay')) return false;
      return true;
    }

    return false;
  });
}