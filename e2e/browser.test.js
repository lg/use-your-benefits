import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads successfully', async ({ page }) => {
    await expect(page.locator('text=Credit Card Benefits')).toBeVisible();
  });

  test('shows all cards', async ({ page }) => {
    await expect(page.locator('text=American Express Platinum')).toBeVisible();
    await expect(page.locator('text=Chase Sapphire Reserve')).toBeVisible();
  });

  test('shows summary stats', async ({ page }) => {
    await expect(page.locator('text=Total Value')).toBeVisible();
  });

  test('shows all benefits', async ({ page }) => {
    await expect(page.locator('text=Uber Cash')).toBeVisible();
    await expect(page.locator('text=Saks Fifth Avenue')).toBeVisible();
    await expect(page.locator('text=Airline Fee Credit')).toBeVisible();
    await expect(page.locator('text=Travel Credit')).toBeVisible();
    await expect(page.locator('text=Global Entry/TSA PreCheck')).toBeVisible();
  });
});

test.describe('Benefit Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays benefit name and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Uber Cash' })).toBeVisible();
    await expect(page.getByText('$200 annually for Uber rides and Eats')).toBeVisible();
  });

  test('shows progress bar', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.getByText('$0 / $200')).toBeVisible();
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
  });

  test('opens when Edit button clicked', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('pre-fills current amount', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    const input = dialog.getByLabel('Amount Used ($200 total)');
    await expect(input).toHaveValue('0');
  });

  test('saves updated amount', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Amount Used ($200 total)').fill('100');
    await dialog.getByRole('button', { name: 'Save' }).click();
    
    await expect(uberCard.getByText('$100 / $200')).toBeVisible();
  });

  test('cancels without saving', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    const initialValue = await uberCard.getByText(/\$\d+ \/ \$200/).textContent();
    expect(initialValue).not.toBeNull();

    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Amount Used ($200 total)').fill('100');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    
    await expect(uberCard.getByText(initialValue?.trim() ?? '')).toBeVisible();
  });

  test('Clear button resets to 0', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Amount Used ($200 total)').fill('100');
    await dialog.getByRole('button', { name: 'Clear' }).click();
    await expect(dialog.getByLabel('Amount Used ($200 total)')).toHaveValue('0');
  });

  test('Full Amount button sets to max', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Full Amount' }).click();
    await expect(dialog.getByLabel('Amount Used ($200 total)')).toHaveValue('200');
  });
});

test.describe('Activation Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows Needs Activation for unactivated benefits', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await expect(uberCard.getByRole('button', { name: 'Needs Activation' })).toBeVisible();
  });

  test('toggles to Activated when clicked', async ({ page }) => {
    const uberCard = page.locator('.benefit-card', { hasText: 'Uber Cash' });
    await uberCard.getByRole('button', { name: 'Needs Activation' }).click();
    await expect(uberCard.getByRole('button', { name: 'Activated' })).toBeVisible();
  });
});

test.describe('Card Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
