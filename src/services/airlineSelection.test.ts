import { expect, it } from 'bun:test';
import { inferAirlineSelection } from './airlineSelection';

const credit = { date: '2026-08-12', amount: 8, description: 'AMEX Airline Fee Reimbursement' };
const purchase = { date: '2026-08-09', amount: 8, description: 'WWW.UNITED.COM\nWIFI\nCarrier : UNITED AIRLINES' };

it('infers an airline from a matching reimbursed purchase regardless of row order', () => {
  expect(inferAirlineSelection([credit], [purchase], 2026)?.name).toBe('United Airlines');
  expect(inferAirlineSelection([credit], [purchase, { ...purchase, amount: -8 }].reverse(), 2026)?.creditCount).toBe(1);
});

it('recognizes an airline explicitly named by the credit', () => {
  expect(inferAirlineSelection([{ ...credit, description: 'AMEX Airline Fee Reimbursement Delta Air Lines' }], [], 2026)?.name).toBe('Delta Air Lines');
});

it('does not infer from refunds, later purchases, distant dates or a different year', () => {
  for (const transaction of [{ ...purchase, amount: -8 }, { ...purchase, date: '2026-08-13' }, { ...purchase, date: '2026-07-01' }, { ...purchase, amount: 80 }]) {
    expect(inferAirlineSelection([credit], [transaction], 2026)).toBeUndefined();
  }
  expect(inferAirlineSelection([credit], [purchase], 2025)).toBeUndefined();
  expect(inferAirlineSelection([], [purchase], 2026)).toBeUndefined();
});

it('leaves conflicting or ambiguous airline evidence unknown', () => {
  expect(inferAirlineSelection([credit], [purchase, { ...purchase, description: 'American Airlines' }], 2026)).toBeUndefined();
  expect(inferAirlineSelection([credit, { ...credit, description: 'AMEX Airline Fee Reimbursement Southwest' }], [purchase], 2026)).toBeUndefined();
});
