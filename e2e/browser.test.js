import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('loads successfully', async ({ page }) => {
    await expect(page.locator('text=Use Your Benefits')).toBeVisible();
  });

  test('shows all cards', async ({ page }) => {
    await expect(page.getByText('American Express Platinum')).toBeVisible();
  });

  test('shows summary stats', async ({ page }) => {
    await expect(page.locator('text=Total Value')).toBeVisible();
  });

  test('shows all benefits', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Uber Cash' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saks Fifth Avenue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Airline Fee' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Global Entry/TSA PreCheck' }).first()).toBeVisible();
  });
});

test.describe('Benefit Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('displays benefit name and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Uber Cash' })).toBeVisible();
    await expect(page.getByText('$200 annually ($15 monthly + $20 in December)')).toBeVisible();
  });

  test('shows progress bar', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.getByText(/\$\d+ \/ \$200/)).toBeVisible();
  });

  test('shows status badge', async ({ page }) => {
    await expect(page.getByText('Pending').first()).toBeVisible();
  });

  test('shows expiration date', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.getByText('Expires: Dec 31, 2026')).toBeVisible();
  });
});

test.describe('Enrollment Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('enrollment button toggles and persists on reload', async ({ page }) => {
    // Find a benefit that requires enrollment (Airline Fee Credit does)
    const benefitCard = page.locator('.benefit-card', { hasText: 'Airline Fee' });
    
    // Initially should show "Needs Enrollment" button
    const enrollButton = benefitCard.getByRole('button', { name: 'Needs Enrollment' });
    await expect(enrollButton).toBeVisible();
    
    // Click to toggle enrollment
    await enrollButton.click();
    
    // Should now show "Enrolled"
    await expect(benefitCard.getByRole('button', { name: 'Enrolled' })).toBeVisible();
    
    // Reload and verify it persisted
    await page.reload();
    const reloadedCard = page.locator('.benefit-card', { hasText: 'Airline Fee' });
    await expect(reloadedCard.getByRole('button', { name: 'Enrolled' })).toBeVisible();
  });
});

test.describe('Transaction-based Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('current period without transactions shows as current (not completed)', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-one': {
            enrolled: true,
            ignored: false
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber One' });
    // Current period without transactions shows as 'current' class
    await expect(uberCard.locator('.progress-segment.current')).toHaveCount(1);
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(0);
  });

  test('period with transactions summing to full amount shows as completed', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-one': {
            enrolled: true,
            ignored: false
          }
        },
        cardTransactions: {
          'amex-platinum': {
            transactions: [
              { date: '2026-01-15T00:00:00.000Z', description: 'Platinum Uber One Credit', amount: -120 }
            ],
            importedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber One' });
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(1);
  });

  test('stale usedAmount is ignored without transactions', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-one': {
            enrolled: true,
            ignored: false
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber One' });
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(0);
    // Current period shows as 'current' class, not 'pending'
    await expect(uberCard.locator('.progress-segment.current')).toHaveCount(1);
  });

  test('benefit with sufficient transactions shows completed segment', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-cash': {
            enrolled: true,
            ignored: false
          }
        },
        cardTransactions: {
          'amex-platinum': {
            transactions: [
              { date: '2026-01-15T00:00:00.000Z', description: 'Platinum Uber Cash Credit', amount: -17 }
            ],
            importedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(1);
  });

  test('benefit without transactions shows as pending segment', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-cash': {
            enrolled: true,
            ignored: false,
            transactions: []
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(0);
    await expect(uberCard.locator('.progress-segment.missed')).toHaveCount(0);
    await expect(uberCard.locator('.progress-segment.partial')).toHaveCount(0);
  });
});

test.describe('Past Year Segments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('all segments have color (no pending) when viewing a past year', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-global-entry': {
            enrolled: true,
            ignored: false
          }
        },
        cardTransactions: {
          'amex-platinum': {
            transactions: [
              { date: '2025-01-10T00:00:00.000Z', description: 'Platinum Global Entry Credit', amount: -120 }
            ],
            importedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    await page.getByRole('button', { name: '2025', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.progress-segment.pending')).toHaveCount(0);

    const allSegments = page.locator('.progress-segment');
    const segmentCount = await allSegments.count();
    expect(segmentCount).toBeGreaterThan(0);

    for (let i = 0; i < segmentCount; i++) {
      const segment = allSegments.nth(i);
      await expect(segment).toHaveClass(/(completed|missed)/);
    }
  });

  test('saks shows two completed segments in 2025', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-saks': {
            enrolled: true,
            ignored: false
          }
        },
        cardTransactions: {
          'amex-platinum': {
            transactions: [
              { date: '2025-02-14T00:00:00.000Z', description: 'Shop Saks with Platinum Credit', amount: -50 },
              { date: '2025-08-08T00:00:00.000Z', description: 'Platinum Saks Credit', amount: -50 }
            ],
            importedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    await page.getByRole('button', { name: '2025', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    const saksCard = page.locator('.benefit-card', { hasText: 'Saks Fifth Avenue' });
    await expect(saksCard.locator('.progress-segment.completed')).toHaveCount(2);
    await expect(saksCard.locator('.progress-segment.missed')).toHaveCount(0);
    await expect(saksCard.locator('.progress-segment.pending')).toHaveCount(0);
  });

  test('digital entertainment shows completed months except November in 2025', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-digital-entertainment': {
            enrolled: true,
            ignored: false
          }
        },
        cardTransactions: {
          'amex-platinum': {
            transactions: [
              { date: '2025-01-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-02-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-03-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-04-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-05-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-06-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-07-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-08-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-09-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-10-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 },
              { date: '2025-12-15T00:00:00.000Z', description: 'Platinum Digital Entertainment Credit', amount: -25 }
            ],
            importedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    await page.getByRole('button', { name: '2025', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    const entertainmentCard = page.locator('.benefit-card', { hasText: 'Digital Entertainment' });
    await expect(entertainmentCard.locator('.progress-segment.completed')).toHaveCount(11);
    await expect(entertainmentCard.locator('.progress-segment.missed')).toHaveCount(1);
    await expect(entertainmentCard.locator('.progress-segment.pending')).toHaveCount(0);
  });

  test('lululemon shows completed first quarter and gray remaining segments in 2026', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-lululemon': {
            enrolled: true,
            ignored: false
          }
        },
        cardTransactions: {
          'amex-platinum': {
            transactions: [
              { date: '2026-01-11T00:00:00.000Z', description: 'Platinum Lululemon Credit', amount: -75 }
            ],
            importedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    await page.getByRole('button', { name: '2026', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    const lululemonCard = page.locator('.benefit-card', { hasText: 'lululemon' });
    await expect(lululemonCard.locator('.progress-segment.completed')).toHaveCount(1);
    await expect(lululemonCard.locator('.progress-segment.missed')).toHaveCount(0);
    await expect(lululemonCard.locator('.progress-segment.pending')).toHaveCount(3);
  });
});
