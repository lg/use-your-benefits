import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import app from '../index'

const staticData = {
  cards: [
    {
      id: 'amex-platinum',
      name: 'American Express Platinum',
      annualFee: 695,
      resetBasis: 'calendar-year',
      color: '#006fcf'
    },
    {
      id: 'chase-sapphire-reserve',
      name: 'Chase Sapphire Reserve',
      annualFee: 550,
      resetBasis: 'anniversary',
      color: '#117aca'
    }
  ],
  benefits: [
    {
      id: 'amex-uber',
      cardId: 'amex-platinum',
      name: 'Uber Cash',
      shortDescription: '$200 annually for Uber rides and Eats',
      fullDescription: 'Receive up to $200 in statement credits annually for Uber rides and Uber Eats orders. The $15 monthly credits plus $35 December bonus are combined into a single annual credit for simplified tracking.',
      creditAmount: 200,
      resetFrequency: 'annual',
      activationRequired: true,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
      category: 'Transportation'
    },
    {
      id: 'amex-saks',
      cardId: 'amex-platinum',
      name: 'Saks Fifth Avenue',
      shortDescription: '$100 annually ($50 twice per year)',
      fullDescription: 'Up to $100 in statement credits annually at Saks Fifth Avenue, split as $50 for the first half of the year (January-June) and $50 for the second half (July-December). Valid for in-store and online purchases.',
      creditAmount: 100,
      resetFrequency: 'twice-yearly',
      activationRequired: false,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-06-30T23:59:59Z',
      category: 'Shopping',
      periods: [
        {
          id: 'amex-saks-p1',
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-06-30T23:59:59Z'
        },
        {
          id: 'amex-saks-p2',
          startDate: '2026-07-01T00:00:00Z',
          endDate: '2026-12-31T23:59:59Z'
        }
      ]
    },
    {
      id: 'amex-airline',
      cardId: 'amex-platinum',
      name: 'Airline Fee Credit',
      shortDescription: '$200 annually for one airline',
      fullDescription: 'Select one qualifying airline each year and receive up to $200 in statement credits for incidental charges such as checked bags, seat assignments, and inflight purchases. Does not cover airline tickets or upgrades.',
      creditAmount: 200,
      resetFrequency: 'annual',
      activationRequired: true,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
      category: 'Travel'
    },
    {
      id: 'chase-travel',
      cardId: 'chase-sapphire-reserve',
      name: 'Travel Credit',
      shortDescription: '$300 annually for any travel purchase',
      fullDescription: 'Receive up to $300 in statement credits annually for travel purchases. Covers airlines, hotels, rental cars, taxis, rideshares, and other travel-related expenses. Credits apply automatically as statement credits.',
      creditAmount: 300,
      resetFrequency: 'annual',
      activationRequired: false,
      startDate: '2025-07-01T00:00:00Z',
      endDate: '2026-06-30T23:59:59Z',
      category: 'Travel'
    },
    {
      id: 'chase-global-entry',
      cardId: 'chase-sapphire-reserve',
      name: 'Global Entry/TSA PreCheck',
      shortDescription: '$120 every 4 years',
      fullDescription: 'Statement credit up to $120 every 4 years for Global Entry application fee, or up to $85 for TSA PreCheck. Provides expedited security screening at participating airports and expedited customs processing when entering the US.',
      creditAmount: 120,
      resetFrequency: 'quarterly',
      activationRequired: false,
      startDate: '2025-07-01T00:00:00Z',
      endDate: '2026-06-30T23:59:59Z',
      category: 'Travel',
      periods: [
        {
          id: 'chase-ge-p1',
          startDate: '2025-07-01T00:00:00Z',
          endDate: '2025-09-30T23:59:59Z'
        },
        {
          id: 'chase-ge-p2',
          startDate: '2025-10-01T00:00:00Z',
          endDate: '2025-12-31T23:59:59Z'
        },
        {
          id: 'chase-ge-p3',
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-03-31T23:59:59Z'
        },
        {
          id: 'chase-ge-p4',
          startDate: '2026-04-01T00:00:00Z',
          endDate: '2026-06-30T23:59:59Z'
        }
      ]
    }
  ]
}

const defaultUserData = {
  benefits: {
    'chase-travel': {
      currentUsed: 0,
      activationAcknowledged: true,
      notes: '',
      status: 'pending',
      ignored: true
    }
  }
}

let tempDir = ''

function writeFixtures() {
  const staticPath = join(tempDir, 'benefits.json')
  const userPath = join(tempDir, 'user-benefits.json')

  writeFileSync(staticPath, JSON.stringify(staticData, null, 2))
  writeFileSync(userPath, JSON.stringify(defaultUserData, null, 2))
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'benefits-api-tests-'))
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

async function request(path: string, init?: RequestInit) {
  const url = `http://localhost${path}`
  return app.fetch(new Request(url, init))
}

describe('GET /api/cards', () => {
  it('returns all credit cards', async () => {
    const res = await request('/api/cards')
    expect(res.status).toBe(200)
    
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(2)
  })
  
  it('returns cards with correct properties', async () => {
    const res = await request('/api/cards')
    const data = await res.json()
    
    const card = data.data[0]
    expect(card).toHaveProperty('id')
    expect(card).toHaveProperty('name')
    expect(card).toHaveProperty('annualFee')
    expect(card).toHaveProperty('resetBasis')
    expect(card).toHaveProperty('color')
  })
  
  it('includes Amex and Chase cards', async () => {
    const res = await request('/api/cards')
    const data = await res.json()
    const names = data.data.map((c: any) => c.name)
    
    expect(names).toContain('American Express Platinum')
    expect(names).toContain('Chase Sapphire Reserve')
  })
})

describe('GET /api/benefits', () => {
  it('returns all benefits when no filter', async () => {
    const res = await request('/api/benefits')
    expect(res.status).toBe(200)
    
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(4)
  })
  
  it('filters benefits by cardId', async () => {
    const res = await request('/api/benefits?cardId=amex-platinum')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(3)
    data.data.forEach((b: any) => {
      expect(b.cardId).toBe('amex-platinum')
    })
  })
  
  it('filters Chase benefits correctly', async () => {
    const res = await request('/api/benefits?cardId=chase-sapphire-reserve')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(1)
    data.data.forEach((b: any) => {
      expect(b.cardId).toBe('chase-sapphire-reserve')
    })
  })
  
  it('returns empty array for unknown cardId', async () => {
    const res = await request('/api/benefits?cardId=unknown')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(0)
  })
  
  it('excludes ignored benefits by default', async () => {
    // First ignore a benefit
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: true })
    })
    
    const res = await request('/api/benefits')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    const uberBenefit = data.data.find((b: any) => b.id === 'amex-uber')
    expect(uberBenefit).toBeUndefined()
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: false })
    })
  })
  
  it('includes ignored benefits when includeIgnored=true', async () => {
    // First ignore a benefit
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: true })
    })
    
    const res = await request('/api/benefits?includeIgnored=true')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    const uberBenefit = data.data.find((b: any) => b.id === 'amex-uber')
    expect(uberBenefit).toBeDefined()
    expect(uberBenefit.ignored).toBe(true)
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: false })
    })
  })
})

describe('GET /api/benefits/:id', () => {
  it('returns single benefit', async () => {
    const res = await request('/api/benefits/amex-uber')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('amex-uber')
    expect(data.data.name).toBe('Uber Cash')
  })
  
  it('returns 404 for non-existent benefit', async () => {
    const res = await request('/api/benefits/non-existent')
    const data = await res.json()
    
    expect(res.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error).toContain('not found')
  })
  
  it('returns benefit with all properties', async () => {
    const res = await request('/api/benefits/amex-uber')
    const data = await res.json()
    const benefit = data.data
    
    expect(benefit).toHaveProperty('id')
    expect(benefit).toHaveProperty('cardId')
    expect(benefit).toHaveProperty('name')
    expect(benefit).toHaveProperty('shortDescription')
    expect(benefit).toHaveProperty('fullDescription')
    expect(benefit).toHaveProperty('creditAmount')
    expect(benefit).toHaveProperty('currentUsed')
    expect(benefit).toHaveProperty('resetFrequency')
    expect(benefit).toHaveProperty('activationRequired')
    expect(benefit).toHaveProperty('status')
  })
})

describe('PATCH /api/benefits/:id', () => {
  it('updates currentUsed amount', async () => {
    const res = await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUsed: 100 })
    })
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.currentUsed).toBe(100)
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUsed: 0 })
    })
  })
  
  it('updates notes field', async () => {
    const res = await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Test note' })
    })
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.data.notes).toBe('Test note')
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: '' })
    })
  })
  
  it('returns 404 for non-existent benefit', async () => {
    const res = await request('/api/benefits/non-existent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUsed: 100 })
    })
    const data = await res.json()
    
    expect(res.status).toBe(404)
    expect(data.success).toBe(false)
  })
  
  it('calculates completed status when fully used', async () => {
    const res = await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUsed: 200 })
    })
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.data.status).toBe('completed')
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUsed: 0, status: 'pending' })
    })
  })
  
  it('sets ignored to true', async () => {
    const res = await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: true })
    })
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.ignored).toBe(true)
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: false })
    })
  })
  
  it('sets ignored to false', async () => {
    // First ignore it
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: true })
    })
    
    const res = await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: false })
    })
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.ignored).toBe(false)
  })
})

describe('PATCH /api/benefits/:id/activate', () => {
  it('toggles activation acknowledgment', async () => {
    // First get the current state
    const currentRes = await request('/api/benefits/amex-uber')
    const currentData = await currentRes.json()
    const wasActivated = currentData.data.activationAcknowledged
    
    const res = await request('/api/benefits/amex-uber/activate', {
      method: 'PATCH'
    })
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.activationAcknowledged).toBe(!wasActivated)
  })
  
  it('returns error for non-activatable benefit', async () => {
    const res = await request('/api/benefits/chase-travel/activate', {
      method: 'PATCH'
    })
    const data = await res.json()
    
    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
  })
})

describe('GET /api/reminders', () => {
  it('returns upcoming expirations', async () => {
    const res = await request('/api/reminders?days=30')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })
  
  it('returns empty array when no expiring soon', async () => {
    const res = await request('/api/reminders?days=1')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
  })
})

describe('GET /api/stats', () => {
  it('returns overall statistics', async () => {
    const res = await request('/api/stats')
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('totalBenefits')
    expect(data.data).toHaveProperty('totalValue')
    expect(data.data).toHaveProperty('usedValue')
    expect(data.data).toHaveProperty('completedCount')
    expect(data.data).toHaveProperty('pendingCount')
    expect(data.data).toHaveProperty('missedCount')
  })
  
  it('stats values are non-negative', async () => {
    const res = await request('/api/stats')
    const data = await res.json()
    
    expect(data.data.totalBenefits).toBeGreaterThanOrEqual(0)
    expect(data.data.totalValue).toBeGreaterThanOrEqual(0)
    expect(data.data.usedValue).toBeGreaterThanOrEqual(0)
    expect(data.data.completedCount).toBeGreaterThanOrEqual(0)
    expect(data.data.pendingCount).toBeGreaterThanOrEqual(0)
    expect(data.data.missedCount).toBeGreaterThanOrEqual(0)
  })
  
  it('excludes ignored benefits from stats', async () => {
    // Get initial stats
    const beforeRes = await request('/api/stats')
    const beforeData = await beforeRes.json()
    const initialTotal = beforeData.data.totalBenefits
    const initialValue = beforeData.data.totalValue
    
    // Ignore a benefit
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: true })
    })
    
    // Get stats after ignoring
    const afterRes = await request('/api/stats')
    const afterData = await afterRes.json()
    
    expect(afterData.data.totalBenefits).toBe(initialTotal - 1)
    expect(afterData.data.totalValue).toBe(initialValue - 200)
    
    // Reset
    await request('/api/benefits/amex-uber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored: false })
    })
  })
})
