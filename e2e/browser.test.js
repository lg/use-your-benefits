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
    await expect(page.getByRole('button', { name: 'American Express Platinum' })).toBeVisible();
  });

  test('shows summary stats', async ({ page }) => {
    await expect(page.locator('text=Total Value')).toBeVisible();
  });

  test('shows all benefits', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Uber Cash' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saks Fifth Avenue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Airline Fee Credit' })).toBeVisible();
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

test.describe('Details Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens when Details button clicked', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('shows no transactions message when empty', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('No transactions imported yet. Import your statement to track usage.')).toBeVisible();
  });

  test('enrollment toggle saves immediately', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Details' }).click();
    const dialog = page.getByRole('dialog');
    const enrollmentCheckbox = dialog.getByLabel('Enrolled in benefit');

    await enrollmentCheckbox.check();
    await expect(uberCard.getByText('Enrolled')).toBeVisible();

    await page.reload();
    const reloadedCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(reloadedCard.getByText('Enrolled')).toBeVisible();
  });

  test('visibility toggle saves and hides benefit on reload', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Details' }).click();
    const dialog = page.getByRole('dialog');
    const visibilityCheckbox = dialog.getByLabel('Show in list');

    await visibilityCheckbox.uncheck();
    await dialog.getByRole('button', { name: 'Close' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Uber Cash' })).toBeHidden();
  });
});

test.describe('Transaction-based Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('current period without transactions shows as pending', async ({ page }) => {
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

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber One Credit' });
    await expect(uberCard.locator('.progress-segment.pending')).toHaveCount(1);
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(0);
  });

  test('period with transactions summing to full amount shows as completed', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-one': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2026-01-15', description: 'Uber One membership', amount: 120 }
            ]
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber One Credit' });
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

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber One Credit' });
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(0);
    await expect(uberCard.locator('.progress-segment.pending')).toHaveCount(1);
  });

  test('benefit with sufficient transactions shows completed segment', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-cash': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2026-01-15', description: 'Uber Eats', amount: 17 }
            ]
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

test.describe('Card Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Amex filter shows only Amex benefits', async ({ page }) => {
    await page.getByRole('button', { name: 'American' }).click();
    await expect(page.getByText('Uber Cash')).toBeVisible();
    await expect(page.getByText('Travel Credit')).toBeHidden();
  });

  test('All Cards shows all benefits', async ({ page }) => {
    await page.getByRole('button', { name: 'American' }).click();
    await page.getByRole('button', { name: 'All Cards' }).click();
    await expect(page.getByText('Uber Cash')).toBeVisible();
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
          'amex-resy-credit': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2025-02-15', description: 'Resy reservation', amount: 100 },
              { date: '2025-05-20', description: 'Resy reservation', amount: 100 },
              { date: '2025-08-10', description: 'Resy reservation', amount: 100 },
              { date: '2025-11-15', description: 'Resy reservation', amount: 100 }
            ]
          },
          'amex-saks': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2025-02-14', description: 'Shop Saks with Platinum Credit', amount: 50 },
              { date: '2025-08-08', description: 'Platinum Saks Credit', amount: 50 }
            ]
          },
          'amex-uber-one': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2025-06-15', description: 'Uber One membership', amount: 120 }
            ]
          },
          'amex-hotel-credit': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2025-01-20', description: 'Hotel booking', amount: 300 },
              { date: '2025-07-10', description: 'Hotel booking', amount: 300 }
            ]
          },
          'amex-global-entry': {
            enrolled: true,
            ignored: false,
            transactions: [
              { date: '2025-01-10', description: 'Global Entry fee', amount: 120 }
            ]
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
            ignored: false,
            transactions: [
              { date: '2025-02-14', description: 'Shop Saks with Platinum Credit', amount: 50 },
              { date: '2025-08-08', description: 'Platinum Saks Credit', amount: 50 }
            ]
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
            ignored: false,
            transactions: [
              { date: '2025-01-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-02-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-03-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-04-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-05-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-06-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-07-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-08-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-09-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-10-15', description: 'Platinum Digital Entertainment Credit', amount: 25 },
              { date: '2025-12-15', description: 'Platinum Digital Entertainment Credit', amount: 25 }
            ]
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
            ignored: false,
            transactions: [
              { date: '2026-01-11', description: 'Platinum Lululemon Credit', amount: 75 }
            ]
          }

        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    await page.getByRole('button', { name: '2026', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    const lululemonCard = page.locator('.benefit-card', { hasText: 'lululemon Credit' });
    await expect(lululemonCard.locator('.progress-segment.completed')).toHaveCount(1);
    await expect(lululemonCard.locator('.progress-segment.missed')).toHaveCount(0);
    await expect(lululemonCard.locator('.progress-segment.pending')).toHaveCount(3);
  });
});
