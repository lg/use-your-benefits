import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getBenefits, getBenefitById, updateBenefit, getUpcomingExpirations } from '../models/storage'
import { updateBenefitUsage, toggleActivation, getStats } from './benefits'
import { staticData, defaultUserData } from '../test/fixtures'

let tempDir = ''

function writeFixtures() {
  const staticPath = join(tempDir, 'benefits.json')
  const userPath = join(tempDir, 'user-benefits.json')

  writeFileSync(staticPath, JSON.stringify(staticData, null, 2))
  writeFileSync(userPath, JSON.stringify(defaultUserData, null, 2))
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'benefits-tests-'))
  process.env.BENEFITS_DATA_PATH = join(tempDir, 'benefits.json')
  process.env.USER_BENEFITS_DATA_PATH = join(tempDir, 'user-benefits.json')
  writeFixtures()
})

beforeEach(() => {
  writeFixtures()
})

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
  delete process.env.BENEFITS_DATA_PATH
  delete process.env.USER_BENEFITS_DATA_PATH
})

describe('getBenefits', () => {
  it('returns all non-ignored benefits by default', () => {
    const benefits = getBenefits()
    
    expect(benefits.every(b => !b.ignored)).toBe(true)
  })
  
  it('excludes ignored benefits by default', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const benefits = getBenefits()
    const uberBenefit = benefits.find(b => b.id === 'amex-uber')
    expect(uberBenefit).toBeUndefined()
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
  
  it('includes ignored benefits when includeIgnored=true', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const benefits = getBenefits(undefined, true)
    const uberBenefit = benefits.find(b => b.id === 'amex-uber')
    expect(uberBenefit).toBeDefined()
    expect(uberBenefit?.ignored).toBe(true)
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
  
  it('filters by cardId and excludes ignored', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const benefits = getBenefits('amex-platinum')
    const uberBenefit = benefits.find(b => b.id === 'amex-uber')
    expect(uberBenefit).toBeUndefined()
    expect(benefits).toHaveLength(2) // Only saks and airline left
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
  
  it('filters by cardId and includes ignored when requested', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const benefits = getBenefits('amex-platinum', true)
    const uberBenefit = benefits.find(b => b.id === 'amex-uber')
    expect(uberBenefit).toBeDefined()
    expect(uberBenefit?.ignored).toBe(true)
    expect(benefits).toHaveLength(3)
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
})

describe('getUpcomingExpirations', () => {
  it('excludes ignored benefits', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const expirations = getUpcomingExpirations(365)
    const uberBenefit = expirations.find(b => b.id === 'amex-uber')
    expect(uberBenefit).toBeUndefined()
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
  
  it('includes ignored when includeIgnored=true', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const expirations = getUpcomingExpirations(365, true)
    const uberBenefit = expirations.find(b => b.id === 'amex-uber')
    expect(uberBenefit).toBeDefined()
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
})

describe('updateBenefitUsage', () => {
  it('updates currentUsed amount', () => {
    const benefit = getBenefitById('amex-uber')
    const originalUsed = benefit?.currentUsed ?? 0
    
    const updated = updateBenefitUsage('amex-uber', 100)
    
    expect(updated.currentUsed).toBe(100)
    expect(updated.status).toBe('pending')
    
    // Reset for other tests
    updateBenefitUsage('amex-uber', originalUsed)
  })
  
  it('calculates completed status when fully used', () => {
    const updated = updateBenefitUsage('amex-uber', 200)
    expect(updated.status).toBe('completed')
    
    // Reset
    updateBenefitUsage('amex-uber', 0)
  })
  
  it('updates notes when provided', () => {
    const updated = updateBenefitUsage('amex-uber', 50, 'Used for airport ride')
    
    expect(updated.notes).toBe('Used for airport ride')
    
    // Reset
    updateBenefitUsage('amex-uber', 0, '')
  })
  
  it('preserves existing notes when not provided', () => {
    // First set a note
    updateBenefitUsage('amex-uber', 0, 'Existing note')
    
    // Update usage without changing notes
    const updated = updateBenefitUsage('amex-uber', 25)
    
    expect(updated.notes).toBe('Existing note')
    
    // Reset
    updateBenefitUsage('amex-uber', 0, '')
  })
  
  it('throws error for non-existent benefit', () => {
    expect(() => updateBenefitUsage('non-existent', 100)).toThrow('Benefit not found')
  })
})

describe('toggleActivation', () => {
  it('toggles activation for benefits requiring it', () => {
    const benefit = getBenefitById('amex-uber')
    const original = benefit?.activationAcknowledged ?? false
    
    const updated = toggleActivation('amex-uber')
    expect(updated.activationAcknowledged).toBe(!original)
    
    // Toggle back
    toggleActivation('amex-uber')
  })
  
  it('throws error for benefit without activation', () => {
    expect(() => toggleActivation('chase-travel')).toThrow('does not require activation')
  })
  
  it('throws error for non-existent benefit', () => {
    expect(() => toggleActivation('non-existent')).toThrow('Benefit not found')
  })
})

describe('getStats', () => {
  it('calculates overall statistics', () => {
    const stats = getStats()
    
    expect(stats).toHaveProperty('totalBenefits')
    expect(stats).toHaveProperty('totalValue')
    expect(stats).toHaveProperty('usedValue')
    expect(stats).toHaveProperty('completedCount')
    expect(stats).toHaveProperty('pendingCount')
    expect(stats).toHaveProperty('missedCount')
  })
  
  it('totals match sum of all benefits', () => {
    const stats = getStats()
    const benefits = getBenefits()
    
    expect(stats.totalBenefits).toBe(benefits.length)
    expect(stats.totalValue).toBe(benefits.reduce((sum, b) => sum + b.creditAmount, 0))
  })
  
  it('counts are non-negative integers', () => {
    const stats = getStats()
    
    expect(stats.totalBenefits).toBeGreaterThanOrEqual(0)
    expect(stats.completedCount).toBeGreaterThanOrEqual(0)
    expect(stats.pendingCount).toBeGreaterThanOrEqual(0)
    expect(stats.missedCount).toBeGreaterThanOrEqual(0)
  })
  
  it('used value is less than or equal to total value', () => {
    const stats = getStats()
    
    expect(stats.usedValue).toBeLessThanOrEqual(stats.totalValue)
  })
  
  it('counts sum to total benefits', () => {
    const stats = getStats()
    
    const sum = stats.completedCount + stats.pendingCount + stats.missedCount
    expect(sum).toBe(stats.totalBenefits)
  })
  
  it('excludes ignored benefits from stats', () => {
    // First ignore a benefit
    updateBenefit('amex-uber', { ignored: true })
    
    const stats = getStats()
    
    expect(stats.totalBenefits).toBe(3)
    expect(stats.totalValue).toBe(420) // 920 - 300 - 200
    
    // Reset
    updateBenefit('amex-uber', { ignored: false })
  })
})
