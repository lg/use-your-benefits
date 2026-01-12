import type { Benefit, BenefitPeriod, BenefitsData } from '../models/types';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../../data/benefits.json');

function readData(): BenefitsData {
  try {
    const data = readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    throw new Error('Failed to read benefits data');
  }
}

function writeData(data: BenefitsData): void {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

export function getCards() {
  const data = readData();
  return data.cards;
}

export function getCardById(id: string) {
  const data = readData();
  return data.cards.find(card => card.id === id);
}

export function getBenefits(cardId?: string) {
  const data = readData();
  if (cardId) {
    return data.benefits.filter(b => b.cardId === cardId);
  }
  return data.benefits;
}

export function getBenefitById(id: string) {
  const data = readData();
  return data.benefits.find(b => b.id === id);
}

export function updateBenefit(id: string, updates: Partial<Benefit>) {
  const data = readData();
  const index = data.benefits.findIndex(b => b.id === id);
  if (index === -1) {
    throw new Error('Benefit not found');
  }
  data.benefits[index] = { ...data.benefits[index], ...updates };
  writeData(data);
  return data.benefits[index];
}

export function updateBenefitPeriod(benefitId: string, periodId: string, updates: Partial<BenefitPeriod>) {
  const data = readData();
  const benefit = data.benefits.find(b => b.id === benefitId);
  if (!benefit) {
    throw new Error('Benefit not found');
  }
  if (!benefit.periods) {
    throw new Error('Benefit has no periods');
  }
  const periodIndex = benefit.periods.findIndex(p => p.id === periodId);
  if (periodIndex === -1) {
    throw new Error('Period not found');
  }
  benefit.periods[periodIndex] = { ...benefit.periods[periodIndex], ...updates };
  writeData(data);
  return benefit.periods[periodIndex];
}

export function getUpcomingExpirations(days: number = 30) {
  const data = readData();
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return data.benefits
    .filter(b => {
      const endDate = new Date(b.endDate);
      return endDate > now && endDate <= cutoff && b.status === 'pending';
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
}
