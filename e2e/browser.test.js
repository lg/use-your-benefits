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
    await expect(page.getByRole('button', { name: 'Chase Sapphire Reserve' })).toBeVisible();
  });

  test('shows summary stats', async ({ page }) => {
    await expect(page.locator('text=Total Value')).toBeVisible();
  });

  test('shows all benefits', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Uber Cash' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saks Fifth Avenue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Airline Fee Credit' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Travel Credit' })).toBeVisible();
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

  test('activation toggle saves immediately', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Details' }).click();
    const dialog = page.getByRole('dialog');
    const activationCheckbox = dialog.getByLabel('Enrolled/activated benefit');

    await activationCheckbox.check();
    await expect(uberCard.getByText('Activated')).toBeVisible();

    await page.reload();
    const reloadedCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(reloadedCard.getByText('Activated')).toBeVisible();
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

  test('past period without transactions shows as missed', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'csr-lyft': {
            currentUsed: 0,
            activationAcknowledged: true,
            status: 'pending',
            ignored: false,
            periods: {
              'csr-lyft-2025-12': {
                usedAmount: 0,
                status: 'pending',
                transactions: []
              }
            }
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const lyftCard = page.locator('.benefit-card', { hasText: 'Lyft Credit' });
    await expect(lyftCard.locator('.progress-segment.missed')).toHaveCount(6);
    await expect(lyftCard.locator('.progress-segment.completed')).toHaveCount(0);
  });

  test('current period without transactions shows as pending', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'csr-lyft': {
            currentUsed: 0,
            activationAcknowledged: true,
            status: 'pending',
            ignored: false,
            periods: {
              'csr-lyft-2026-01': {
                usedAmount: 0,
                status: 'pending',
                transactions: []
              }
            }
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const lyftCard = page.locator('.benefit-card', { hasText: 'Lyft Credit' });
    await expect(lyftCard.locator('.progress-segment.pending')).toHaveCount(1);
    await expect(lyftCard.locator('.progress-segment.completed')).toHaveCount(0);
  });

  test('period with transactions summing to full amount shows as completed', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'csr-lyft': {
            currentUsed: 0,
            activationAcknowledged: true,
            status: 'pending',
            ignored: false,
            periods: {
              'csr-lyft-2026-01': {
                usedAmount: 0,
                status: 'pending',
                transactions: [
                  { date: '2026-01-15', description: 'Lyft ride', amount: 10 }
                ]
              }
            }
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const lyftCard = page.locator('.benefit-card', { hasText: 'Lyft Credit' });
    await expect(lyftCard.locator('.progress-segment.completed')).toHaveCount(1);
  });

  test('stale usedAmount is ignored without transactions', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'csr-lyft': {
            currentUsed: 100,
            activationAcknowledged: true,
            status: 'completed',
            ignored: false,
            periods: {
              'csr-lyft-2025-12': {
                usedAmount: 100,
                status: 'completed',
                transactions: []
              }
            }
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const lyftCard = page.locator('.benefit-card', { hasText: 'Lyft Credit' });
    await expect(lyftCard.locator('.progress-segment.completed')).toHaveCount(0);
    await expect(lyftCard.locator('.progress-segment.missed')).toHaveCount(6);
  });

  test('benefit with sufficient transactions shows completed segment', async ({ page }) => {
    await page.evaluate(() => {
      const userData = {
        benefits: {
          'amex-uber-cash': {
            currentUsed: 0,
            activationAcknowledged: true,
            status: 'pending',
            ignored: false,
            periods: {
              'amex-uber-cash-2026-01': {
                usedAmount: 0,
                status: 'pending',
                transactions: [
                  { date: '2026-01-15', description: 'Uber Eats', amount: 17 }
                ]
              }
            }
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
            currentUsed: 150,
            activationAcknowledged: true,
            status: 'completed',
            ignored: false,
            periods: {
              'amex-uber-cash-2026-01': {
                usedAmount: 150,
                status: 'completed',
                transactions: []
              }
            }
          }
        }
      };
      localStorage.setItem('use-your-benefits', JSON.stringify(userData));
    });
    await page.reload();

    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.locator('.progress-segment.completed')).toHaveCount(0);
    await expect(uberCard.locator('.progress-segment.pending')).toHaveCount(1);
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

  test('Chase filter shows only Chase benefits', async ({ page }) => {
    await page.getByRole('button', { name: 'Chase' }).click();
    await expect(page.getByText('Uber Cash')).toBeHidden();
    await expect(page.getByText('Travel Credit')).toBeVisible();
  });

  test('All Cards shows both', async ({ page }) => {
    await page.getByRole('button', { name: 'American' }).click();
    await page.getByRole('button', { name: 'All Cards' }).click();
    await expect(page.getByText('Uber Cash')).toBeVisible();
    await expect(page.getByText('Travel Credit')).toBeVisible();
  });
});
