import type { BenefitDefinition, BenefitPeriod, BenefitPolicy, BenefitStatus, CardSettings, ResetFrequency, StoredTransaction } from './types';

const DAY = 86_400_000;
const counts: Record<ResetFrequency, number> = { annual: 1, 'twice-yearly': 2, quarterly: 4, monthly: 12, '4-year': 1 };
const money = (amount: number) => Math.round(amount * 100) / 100;
const last = <T,>(items: T[]): T | undefined => items[items.length - 1];
const dateLabel = (time: number) => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const amountLabel = (amount: number) => `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

interface DatedPolicy extends BenefitPolicy {
  start: number;
  end: number;
}

interface SnapshotOptions extends CardSettings {
  now?: Date;
}

interface UserStateLike {
  transactions?: StoredTransaction[];
  annualResetDate?: string;
}

export interface BenefitUsageSnapshot {
  periods: BenefitPeriod[];
  currentUsed: number;
  status: BenefitStatus;
  yearTransactions: StoredTransaction[];
  claimedElsewhereYear?: number;
  effectiveStartDate: string;
  effectiveEndDate: string;
  creditAmount: number;
  annualValue: number;
  availableNow: number | null;
  availabilityNote?: string;
  shortDescription: string;
  resetFrequency: ResetFrequency;
}

function getPolicies(definition: BenefitDefinition, options: SnapshotOptions): DatedPolicy[] {
  // Older definitions remain valid while their history is added.
  const policies = definition.policies ?? [{
    startsOn: '1900-01-01', allowance: definition.creditAmount / counts[definition.resetFrequency],
    resetFrequency: definition.resetFrequency, description: definition.shortDescription, sourceUrls: [],
  }];
  return policies.map(policy => ({ ...policy,
    startsOn: options.newCardDuringRefresh ? policy.newCardStartsOn ?? policy.startsOn : policy.startsOn,
  })).sort((a, b) => a.startsOn.localeCompare(b.startsOn)).map((policy, index, sorted) => ({
    ...policy,
    start: Date.parse(policy.startsOn),
    end: Math.min(policy.endsOn ? Date.parse(policy.endsOn) + DAY - 1 : Infinity,
      sorted[index + 1] ? Date.parse(sorted[index + 1].startsOn) - 1 : Infinity),
  }));
}

function policyAt(policies: DatedPolicy[], time: number): DatedPolicy | undefined {
  return policies.find(policy => time >= policy.start && time <= policy.end);
}

function allowanceAt(policy: DatedPolicy | undefined, time: number): number {
  return policy?.monthlyAllowances?.[new Date(time).getUTCMonth()] ?? policy?.allowance ?? 0;
}

function unavailableReason(policies: DatedPolicy[], start: number, end: number): string {
  const next = policies.find(policy => policy.start > end);
  if (next) return `Benefit starts ${dateLabel(next.start)}. No allowance for this period.`;
  const previous = last(policies.filter(policy => policy.end < start));
  return previous ? `Benefit ended ${dateLabel(previous.end)}. No allowance for this period.` : 'No allowance for this period.';
}

function makePeriod(id: string, start: number, end: number, policies: DatedPolicy[], transactions: StoredTransaction[], reference: number): BenefitPeriod {
  const overlapping = policies.filter(policy => policy.start <= end && policy.end >= start && policy.allowance > 0);
  // A mid-period increase changes the cap without opening another allowance.
  const capDate = Math.min(end, Math.max(start, reference));
  const policy = policyAt(policies, capDate) ?? overlapping.find(item => reference < item.start);
  const allowance = allowanceAt(policy, capDate);
  const activeStart = Math.max(start, overlapping[0]?.start ?? start);
  const activeEnd = Math.min(end, last(overlapping)?.end ?? end);
  const active = allowance > 0 && activeStart <= activeEnd;
  const periodStart = active ? activeStart : start;
  const periodEnd = active ? activeEnd : end;
  const periodTransactions = transactions.filter(tx => {
    const date = Date.parse(tx.date);
    return date >= start && date <= end;
  });
  const usedAmount = money(periodTransactions.reduce((sum, tx) => sum + tx.amount, 0));
  const isCurrent = reference >= periodStart && reference <= periodEnd;
  const status: BenefitStatus = !active ? 'unavailable'
    : usedAmount + 0.001 >= allowance * 0.5 ? 'completed'
    : reference > activeEnd ? 'missed' : 'pending';
  const changes = overlapping.filter((item, index) => index === 0 || item.allowance !== overlapping[index - 1].allowance);
  const notes = [policy?.note];
  if (activeStart > start) notes.push(`Available from ${dateLabel(activeStart)}.`);
  if (changes.length > 1) notes.push(changes.map(item => `${amountLabel(item.allowance)} from ${dateLabel(Math.max(start, item.start))}`).join('. ') + '. Earlier credits count toward the same allowance.');
  if (policy?.maxPerTransaction) notes.push(`Up to ${amountLabel(policy.maxPerTransaction)} per qualifying purchase.`);
  return {
    id, startDate: new Date(periodStart).toISOString(), endDate: new Date(periodEnd).toISOString(),
    allowance, usedAmount, transactions: periodTransactions, status, isCurrent,
    availableNow: active && isCurrent ? money(Math.max(0, allowance - usedAmount)) : 0,
    policyNote: notes.filter(Boolean).join(' ') || undefined,
    unavailableReason: active ? undefined : unavailableReason(policies, start, end),
    sourceUrls: [...new Set(overlapping.flatMap(item => item.sourceUrls))],
    timeProgress: isCurrent ? Math.max(0, Math.min(100, (reference - periodStart) / (periodEnd - periodStart) * 100)) : 0,
    daysLeft: isCurrent ? Math.ceil((periodEnd - reference) / DAY) : 0,
  };
}

function calendarPeriods(definition: BenefitDefinition, policies: DatedPolicy[], transactions: StoredTransaction[], year: number, reference: number): BenefitPeriod[] {
  const periods: BenefitPeriod[] = [];
  const yearEnd = Date.UTC(year + 1, 0, 1) - 1;
  let cursor = Date.UTC(year, 0, 1);
  while (cursor <= yearEnd) {
    const current = policyAt(policies, cursor) ?? policies.find(policy => policy.start > cursor) ?? last(policies)!;
    const span = 12 / counts[current.resetFrequency];
    const startMonth = Math.floor(new Date(cursor).getUTCMonth() / span) * span;
    let end = Math.min(yearEnd, Date.UTC(year, startMonth + span, 1) - 1);
    const reset = policies.find(policy => policy.start > cursor && policy.start <= end
      && (policy.resetOnChange || policy.resetFrequency !== current.resetFrequency));
    if (reset) end = reset.start - 1;
    periods.push(makePeriod(`${definition.id}-${year}-${periods.length + 1}`, cursor, end, policies, transactions, reference));
    cursor = end + 1;
  }
  return periods;
}

function anniversaryPeriod(definition: BenefitDefinition, policies: DatedPolicy[], transactions: StoredTransaction[], resetDate: string, reference: number): BenefitPeriod | null {
  const anchor = new Date(`${resetDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resetDate) || !Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== resetDate) return null;
  const referenceYear = new Date(reference).getUTCFullYear();
  const boundary = (year: number) => Date.UTC(year, anchor.getUTCMonth(), Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, anchor.getUTCMonth() + 1, 0)).getUTCDate()));
  const startYear = reference < boundary(referenceYear) ? referenceYear - 1 : referenceYear;
  return makePeriod(`${definition.id}-anniversary-${startYear}`, boundary(startYear), boundary(startYear + 1) - 1, policies, transactions, reference);
}

export function buildBenefitUsageSnapshot(definition: BenefitDefinition, userState: UserStateLike, selectedYear?: number, options: SnapshotOptions = {}): BenefitUsageSnapshot {
  const now = options.now ?? new Date();
  const year = selectedYear ?? now.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1) - 1;
  const reference = Math.min(yearEnd, Math.max(yearStart, now.getTime()));
  const policies = getPolicies(definition, options);
  const activePolicy = policyAt(policies, reference);
  const displayPolicy = activePolicy ?? policies.find(policy => policy.start > reference) ?? last(policies)!;
  const transactions = definition.excludeFromTotals ? [] : userState.transactions ?? [];
  const yearTransactions = transactions.filter(tx => Date.parse(tx.date) >= yearStart && Date.parse(tx.date) <= yearEnd);
  const currentUsed = money(yearTransactions.reduce((sum, tx) => sum + tx.amount, 0));
  const isCurrentYear = year === now.getUTCFullYear();
  let periods: BenefitPeriod[];
  let claimedElsewhereYear: number | undefined;
  let availabilityNote: string | undefined;
  let unknownAvailability = false;

  if (displayPolicy.resetFrequency === '4-year') {
    const latest = transactions.filter(tx => tx.amount > 0 && Date.parse(tx.date) <= reference)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    const renewal = latest ? new Date(latest.date) : undefined;
    if (renewal) renewal.setUTCFullYear(renewal.getUTCFullYear() + 4);
    const covered = Boolean(latest && renewal && reference < renewal.getTime());
    const period = makePeriod(`${definition.id}-4year`, covered && latest ? Date.parse(latest.date) : yearStart,
      covered && renewal ? renewal.getTime() - 1 : yearEnd, policies, transactions, reference);
    if (covered && latest) {
      period.startDate = latest.date;
      period.endDate = new Date(renewal!.getTime() - 1).toISOString();
      period.status = 'completed';
      period.availableNow = 0;
      period.transactions = [latest];
      period.usedAmount = latest.amount;
      const claimPolicy = policyAt(policies, Date.parse(latest.date)) ?? displayPolicy;
      period.allowance = /tsa.*pre/i.test(latest.description) ? claimPolicy.tsaAllowance ?? claimPolicy.allowance : claimPolicy.allowance;
      const creditYear = new Date(latest.date).getUTCFullYear();
      if (creditYear !== year) claimedElsewhereYear = creditYear;
      period.policyNote = `Credit received ${dateLabel(Date.parse(latest.date))}. Next eligible ${dateLabel(renewal!.getTime())}. ${displayPolicy.note ?? ''}`.trim();
    } else {
      period.policyNote = displayPolicy.note ?? 'Eligibility is based on the credits in your imported history.';
    }
    periods = [period];
  } else if (definition.resetBasis === 'anniversary') {
    const period = userState.annualResetDate ? anniversaryPeriod(definition, policies, transactions, userState.annualResetDate, reference) : null;
    unknownAvailability = !period;
    availabilityNote = period ? 'Availability uses your account anniversary period.' : 'Set the travel credit reset date shown by Chase to calculate availability.';
    periods = period ? [period] : [{ ...makePeriod(`${definition.id}-unknown`, yearStart, yearEnd, policies, transactions, reference),
      status: 'unavailable', isCurrent: false, availableNow: 0, unavailableReason: availabilityNote }];
  } else {
    periods = calendarPeriods(definition, policies, transactions, year, reference);
  }

  if (!isCurrentYear) {
    for (const period of periods) {
      period.isCurrent = false;
      period.availableNow = 0;
      if (year < now.getUTCFullYear() && period.status === 'pending' && Date.parse(period.endDate) <= yearEnd) period.status = 'missed';
    }
  }
  if (definition.excludeFromTotals) {
    for (const period of periods) {
      period.status = 'unavailable';
      period.isCurrent = false;
      period.availableNow = 0;
      period.unavailableReason = 'Excluded from all calculations. Usage is not recorded in the card statement.';
    }
  }

  const validPeriods = periods.filter(period => period.status !== 'unavailable');
  const currentPeriod = periods.find(period => period.isCurrent);
  const status: BenefitStatus = year < now.getUTCFullYear()
    ? validPeriods.length === 0 ? 'unavailable' : validPeriods.filter(period => period.status === 'completed').length >= validPeriods.length / 2 ? 'completed' : 'missed'
    : year > now.getUTCFullYear() ? validPeriods.length ? 'pending' : 'unavailable'
    : currentPeriod?.status ?? (validPeriods.some(period => Date.parse(period.startDate) > reference) ? 'pending' : 'unavailable');
  const creditAmount = definition.resetBasis === 'anniversary'
    ? activePolicy?.allowance ?? 0 : money(periods.reduce((sum, period) => sum + (period.allowance ?? 0), 0));
  const annualValue = displayPolicy.resetFrequency === '4-year' && claimedElsewhereYear ? 0 : creditAmount;
  let shortDescription = displayPolicy.description;
  if (!activePolicy && displayPolicy.end < reference) shortDescription = `Ended ${dateLabel(displayPolicy.end)}`;
  else if (!activePolicy && displayPolicy.start > reference) shortDescription = `Starts ${dateLabel(displayPolicy.start)}`;
  return {
    periods, currentUsed, status, yearTransactions, claimedElsewhereYear, creditAmount,
    annualValue: definition.excludeFromTotals ? 0 : annualValue,
    availableNow: definition.excludeFromTotals || !isCurrentYear ? 0 : unknownAvailability ? null
      : money(periods.reduce((sum, period) => sum + (period.availableNow ?? 0), 0)),
    availabilityNote, shortDescription, resetFrequency: displayPolicy.resetFrequency,
    effectiveStartDate: periods[0].startDate, effectiveEndDate: last(periods)!.endDate,
  };
}
