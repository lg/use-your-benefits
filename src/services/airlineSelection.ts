import type { InferredAirline, StoredTransaction } from '@lib/types';

// Includes historical carriers so older imported years remain recognizable.
const airlines: [string, RegExp][] = [
  ['United Airlines', /\bunited\s*air(?:lines)?\b|\bunited\.com\b/i],
  ['American Airlines', /\bamerican\s*air(?:lines)?\b|\baa\.com\b/i],
  ['Delta Air Lines', /\bdelta\s*air\s*lines?\b|\bdelta\.com\b/i],
  ['Southwest Airlines', /\bsouthwest(?:\s*airlines)?\b/i],
  ['JetBlue Airways', /\bjet\s*blue\b/i],
  ['Alaska Airlines', /\balaska\s*air(?:lines)?\b|\balaskaair\.com\b/i],
  ['Hawaiian Airlines', /\bhawaiian\s*air(?:lines)?\b|\bhawaiianairlines\.com\b/i],
  ['Spirit Airlines', /\bspirit\s*air(?:lines)?\b|\bspirit\.com\b/i],
  ['Frontier Airlines', /\bfrontier\s*air(?:lines)?\b|\bflyfrontier\.com\b/i],
  ['Allegiant Air', /\ballegiant(?:\s*air)?\b/i],
];

function namesIn(description: string): string[] {
  return airlines.filter(([, pattern]) => pattern.test(description)).map(([name]) => name);
}

export function inferAirlineSelection(credits: StoredTransaction[], transactions: StoredTransaction[], year: number): InferredAirline | undefined {
  const evidence: { name: string; date: string }[] = [];
  for (const credit of credits) {
    if (credit.amount <= 0 || new Date(credit.date).getUTCFullYear() !== year) continue;
    const named = namesIn(credit.description);
    // An exact amount within 14 days is a conservative hint, not a bank-provided link.
    const candidates = named.length ? named : transactions.filter(transaction => {
      const delay = Date.parse(credit.date) - Date.parse(transaction.date);
      return transaction.amount > 0 && Math.round(transaction.amount * 100) === Math.round(credit.amount * 100)
        && new Date(transaction.date).getUTCFullYear() === year && delay >= 0 && delay <= 14 * 86_400_000;
    }).flatMap(transaction => namesIn(transaction.description));
    const names = [...new Set(candidates)];
    if (names.length > 1) return undefined;
    if (names.length === 1) evidence.push({ name: names[0], date: credit.date });
  }
  if (!evidence.length || new Set(evidence.map(item => item.name)).size !== 1) return undefined;
  return { name: evidence[0].name, creditCount: evidence.length,
    latestCreditDate: evidence.map(item => item.date).sort((a, b) => Date.parse(b) - Date.parse(a))[0] };
}
