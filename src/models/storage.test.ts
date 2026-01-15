import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getBenefitById, updateBenefit, updateBenefitPeriod } from './storage'

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
        }
      ]
    }
  ]
}

const defaultUserData = {
  benefits: {}
}

let tempDir = ''
let staticPath = ''
let userPath = ''

function writeFixtures(userData = defaultUserData) {
  writeFileSync(staticPath, JSON.stringify(staticData, null, 2))
  writeFileSync(userPath, JSON.stringify(userData, null, 2))
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'benefits-storage-tests-'))
  staticPath = join(tempDir, 'benefits.json')
  userPath = join(tempDir, 'user-benefits.json')
  process.env.BENEFITS_DATA_PATH = staticPath
  process.env.USER_BENEFITS_DATA_PATH = userPath
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

describe('storage user merge', () => {
  it('merges user state into benefit data', () => {
    writeFixtures({
      benefits: {
        'amex-uber': {
          currentUsed: 75,
          activationAcknowledged: false,
          notes: 'Manual update',
          status: 'pending',
          ignored: false
        }
      }
    })

    const benefit = getBenefitById('amex-uber')

    expect(benefit?.creditAmount).toBe(200)
    expect(benefit?.currentUsed).toBe(75)
    expect(benefit?.notes).toBe('Manual update')
    expect(benefit?.activationRequired).toBe(true)
  })

  it('applies default user state when missing', () => {
    const benefit = getBenefitById('amex-airline')

    expect(benefit?.currentUsed).toBe(0)
    expect(benefit?.activationAcknowledged).toBe(false)
    expect(benefit?.notes).toBe('')
    expect(benefit?.ignored).toBe(false)
  })
})

describe('storage user updates', () => {
  it('writes updates only to the user data file', () => {
    updateBenefit('amex-uber', { notes: 'Saved note' })

    const staticContents = JSON.parse(readFileSync(staticPath, 'utf-8'))
    const userContents = JSON.parse(readFileSync(userPath, 'utf-8'))
    const staticBenefit = staticContents.benefits.find((benefit: { id: string }) => benefit.id === 'amex-uber')

    expect(staticBenefit?.notes).toBeUndefined()
    expect(userContents.benefits['amex-uber'].notes).toBe('Saved note')
  })

  it('persists period updates to the user file', () => {
    updateBenefitPeriod('chase-global-entry', 'chase-ge-p1', {
      usedAmount: 25,
      status: 'completed'
    })

    const userContents = JSON.parse(readFileSync(userPath, 'utf-8'))

    expect(userContents.benefits['chase-global-entry'].periods['chase-ge-p1'].usedAmount).toBe(25)
    expect(userContents.benefits['chase-global-entry'].periods['chase-ge-p1'].status).toBe('completed')
  })
})
