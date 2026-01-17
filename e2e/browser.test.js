import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('loads successfully', async ({ page }) => {
    await expect(page.locator('text=Keep Your Benefits')).toBeVisible();
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

test.describe('Edit Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens when Edit button clicked', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('saves period spend', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('spinbutton').fill('15');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(uberCard.getByText('$15 / $200')).toBeVisible();
  });

  test('updates prior period segment for Lyft credit', async ({ page }) => {
    const lyftCard = page.locator('.benefit-card', { hasText: 'Lyft Credit' });
    await expect(lyftCard.locator('.progress-segment.completed')).toHaveCount(0);

    await lyftCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    const priorPeriod = dialog.getByRole('button', { name: /Nov 2025 – Dec 2025/ });
    await priorPeriod.scrollIntoViewIfNeeded();
    await priorPeriod.click();
    await dialog.getByRole('spinbutton').fill('10');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(lyftCard.locator('.progress-segment.completed')).toHaveCount(1);
  });
});

test.describe('Activation Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('updates activation via edit modal and persists', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    const activationLabel = uberCard.getByText(/Needs Activation|Activated/);
    const wasActivated = await activationLabel.innerText();

    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    const activationCheckbox = dialog.getByLabel('Enrolled/activated benefit');

    if (wasActivated === 'Activated') {
      await activationCheckbox.uncheck();
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(uberCard.getByText('Needs Activation')).toBeVisible();

      await page.reload();
      const reloadedCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
      await expect(reloadedCard.getByText('Needs Activation')).toBeVisible();
    } else {
      await activationCheckbox.check();
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(uberCard.getByText('Activated')).toBeVisible();

      await page.reload();
      const reloadedCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
      await expect(reloadedCard.getByText('Activated')).toBeVisible();

      await reloadedCard.getByRole('button', { name: 'Edit' }).click();
      const dialogAfterReload = page.getByRole('dialog');
      await dialogAfterReload.getByLabel('Enrolled/activated benefit').uncheck();
      await dialogAfterReload.getByRole('button', { name: 'Save' }).click();
      await expect(reloadedCard.getByText('Needs Activation')).toBeVisible();

      await page.reload();
      const finalCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
      await expect(finalCard.getByText('Needs Activation')).toBeVisible();
    }
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
