import { describe, it, expect } from 'bun:test'
import { 
  formatDate, 
  getDaysUntilExpiry, 
  calculateBenefitStatus,
  calculatePeriodStatus,
  getProgressPercentage 
} from './dates'
import type { Benefit } from '../models/types'

type PeriodInput = { usedAmount: number; creditAmount: number; endDate: string }

describe('formatDate', () => {
  it('formats ISO date to readable string', () => {
    expect(formatDate('2026-01-15T00:00:00Z')).toBe('Jan 15, 2026')
  })
  
  it('handles end of year dates', () => {
    expect(formatDate('2026-12-31T23:59:59Z')).toBe('Dec 31, 2026')
  })
  
  it('handles mid-year dates', () => {
    expect(formatDate('2026-06-15T12:00:00Z')).toBe('Jun 15, 2026')
  })
  
  it('handles beginning of year dates', () => {
    expect(formatDate('2026-01-01T00:00:00Z')).toBe('Jan 1, 2026')
  })
})

describe('getDaysUntilExpiry', () => {
  it('returns positive days for future date', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const result = getDaysUntilExpiry(futureDate)
    expect(result).toBeGreaterThanOrEqual(7)
    expect(result).toBeLessThanOrEqual(8)
  })
  
  it('returns 0 for today', () => {
    const today = new Date().toISOString()
    const result = getDaysUntilExpiry(today)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(1)
  })
  
  it('returns negative days for past date', () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const result = getDaysUntilExpiry(pastDate)
    expect(result).toBeLessThanOrEqual(-7)
  })
})

describe('calculateBenefitStatus', () => {
  it('returns completed when fully used', () => {
    const benefit = { currentUsed: 200, creditAmount: 200, endDate: '2026-12-31' } as Benefit
    expect(calculateBenefitStatus(benefit)).toBe('completed')
  })
  
  it('returns completed for over-use', () => {
    const benefit = { currentUsed: 250, creditAmount: 200, endDate: '2026-12-31' } as Benefit
    expect(calculateBenefitStatus(benefit)).toBe('completed')
  })
  
  it('returns missed when expired and not fully used', () => {
    const benefit = { currentUsed: 50, creditAmount: 200, endDate: '2020-01-01' } as Benefit
    expect(calculateBenefitStatus(benefit)).toBe('missed')
  })
  
  it('returns pending when active and not fully used', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const benefit = { currentUsed: 50, creditAmount: 200, endDate: futureDate } as Benefit
    expect(calculateBenefitStatus(benefit)).toBe('pending')
  })
  
  it('returns pending when just started with no usage', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    const benefit = { currentUsed: 0, creditAmount: 200, endDate: futureDate } as Benefit
    expect(calculateBenefitStatus(benefit)).toBe('pending')
  })
})

describe('calculatePeriodStatus', () => {
  it('returns completed when period fully used', () => {
    const period = { usedAmount: 50, creditAmount: 50, endDate: '2026-06-30' } as PeriodInput
    expect(calculatePeriodStatus(period)).toBe('completed')
  })
  
  it('returns pending when period active', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const period = { usedAmount: 25, creditAmount: 50, endDate: futureDate } as PeriodInput
    expect(calculatePeriodStatus(period)).toBe('pending')
  })
  
  it('returns missed when period expired', () => {
    const period = { usedAmount: 25, creditAmount: 50, endDate: '2020-01-01' } as PeriodInput
    expect(calculatePeriodStatus(period)).toBe('missed')
  })
  
  it('returns completed when over-used', () => {
    const period = { usedAmount: 75, creditAmount: 50, endDate: '2026-06-30' } as PeriodInput
    expect(calculatePeriodStatus(period)).toBe('completed')
  })
})

describe('getProgressPercentage', () => {
  it('returns 100 when fully used', () => {
    const benefit = { currentUsed: 200, creditAmount: 200 } as Benefit
    expect(getProgressPercentage(benefit)).toBe(100)
  })
  
  it('returns 50 when half used', () => {
    const benefit = { currentUsed: 100, creditAmount: 200 } as Benefit
    expect(getProgressPercentage(benefit)).toBe(50)
  })
  
  it('returns 0 when nothing used', () => {
    const benefit = { currentUsed: 0, creditAmount: 200 } as Benefit
    expect(getProgressPercentage(benefit)).toBe(0)
  })
  
  it('caps at 100 when over-used', () => {
    const benefit = { currentUsed: 250, creditAmount: 200 } as Benefit
    expect(getProgressPercentage(benefit)).toBe(100)
  })
  
  it('handles decimal values', () => {
    const benefit = { currentUsed: 33.33, creditAmount: 100 } as Benefit
    const result = getProgressPercentage(benefit)
    expect(result).toBeCloseTo(33.33, 1)
  })
})
