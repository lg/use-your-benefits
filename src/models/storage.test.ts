import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getBenefitById, updateBenefit, updateBenefitPeriod } from './storage'
import { staticData, emptyUserData, type BenefitsStaticData, type UserBenefitsData } from '../test/fixtures'

// Storage tests use a subset of static data
const storageStaticData: BenefitsStaticData = {
  cards: staticData.cards,
  benefits: staticData.benefits.filter(b => 
    ['amex-uber', 'amex-airline', 'chase-global-entry'].includes(b.id)
  )
};

let tempDir = ''
let staticPath = ''
let userPath = ''

function writeFixtures(userData: UserBenefitsData = emptyUserData) {
  writeFileSync(staticPath, JSON.stringify(storageStaticData, null, 2))
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
