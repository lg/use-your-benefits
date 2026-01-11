import { Context, Next } from 'hono';
import { getCards, getBenefits, getBenefitById, updateBenefit, getUpcomingExpirations } from '../models/storage.ts';
import { updateBenefitUsage, toggleActivation, getAllBenefitsWithCards, getStats } from '../services/benefits.ts';

function jsonResponse(c: Context, data: unknown, status: number = 200) {
  return c.json(data, status);
}

export async function getCardsHandler(c: Context) {
  try {
    const cards = getCards();
    return jsonResponse(c, { success: true, data: cards });
  } catch {
    return jsonResponse(c, { success: false, error: 'Failed to fetch cards' }, 500);
  }
}

export async function getBenefitsHandler(c: Context) {
  try {
    const cardId = c.req.query('cardId');
    const benefits = cardId ? getBenefits(cardId) : getAllBenefitsWithCards();
    return jsonResponse(c, { success: true, data: benefits });
  } catch {
    return jsonResponse(c, { success: false, error: 'Failed to fetch benefits' }, 500);
  }
}

export async function getBenefitHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const benefit = getBenefitById(id);
    if (!benefit) {
      return jsonResponse(c, { success: false, error: 'Benefit not found' }, 404);
    }
    return jsonResponse(c, { success: true, data: benefit });
  } catch {
    return jsonResponse(c, { success: false, error: 'Failed to fetch benefit' }, 500);
  }
}

export async function updateBenefitHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const benefit = getBenefitById(id);
    if (!benefit) {
      return jsonResponse(c, { success: false, error: 'Benefit not found' }, 404);
    }
    
    if (body.currentUsed !== undefined) {
      const updated = updateBenefitUsage(id, body.currentUsed, body.notes);
      return jsonResponse(c, { success: true, data: updated });
    }
    
    const updated = updateBenefit(id, body);
    return jsonResponse(c, { success: true, data: updated });
  } catch {
    return jsonResponse(c, { success: false, error: 'Failed to update benefit' }, 500);
  }
}

export async function toggleActivationHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const updated = toggleActivation(id);
    return jsonResponse(c, { success: true, data: updated });
  } catch (error) {
    return jsonResponse(c, { success: false, error: (error as Error).message }, 400);
  }
}

export async function getRemindersHandler(c: Context) {
  try {
    const days = parseInt(c.req.query('days') || '30');
    const expirations = getUpcomingExpirations(days);
    return jsonResponse(c, { success: true, data: expirations });
  } catch {
    return jsonResponse(c, { success: false, error: 'Failed to fetch reminders' }, 500);
  }
}

export async function getStatsHandler(c: Context) {
  try {
    const stats = getStats();
    return jsonResponse(c, { success: true, data: stats });
  } catch {
    return jsonResponse(c, { success: false, error: 'Failed to fetch stats' }, 500);
  }
}

export async function corsMiddleware(c: Context, next: Next) {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }
  
  await next();
}
