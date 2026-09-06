import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-06T12:00:00Z'));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('use-your-benefits', JSON.stringify({ benefits: {}, cardTransactions: {
      'amex-platinum': { importedAt: '2026-09-06', transactions: [
        { date: '2026-03-08T00:00:00Z', description: 'Shop Saks with Platinum Credit', amount: -50 },
        { date: '2026-04-15T00:00:00Z', description: 'Platinum CLEAR Credit', amount: -199 },
        { date: '2026-08-01T00:00:00Z', description: 'Platinum Resy Credit', amount: -60 },
        { date: '2025-03-15T00:00:00Z', description: 'Platinum Global Entry Credit', amount: -120 },
      ] },
    } }));
  });
  await page.reload();
});

test('Saks ends in June and explains the gray second half on hover', async ({ page }) => {
  const saks = page.locator('.benefit-card', { hasText: 'Saks Fifth Avenue' });
  await expect(saks.getByText('$50 / $50', { exact: true })).toBeVisible();
  await expect(saks.locator('.progress-segment.completed')).toHaveCount(1);
  const discontinued = saks.locator('.progress-segment.unavailable');
  await expect(discontinued.locator('.progress-time-marker')).toBeVisible();
  await discontinued.hover({ position: { x: 20, y: 12 } });
  await expect(page.getByRole('tooltip')).toContainText('Benefit ended Jun 30, 2026. No allowance for this period.');
  await discontinued.locator('.progress-time-marker').hover();
  await expect(page.getByRole('tooltip').last()).toContainText('37% of period elapsed');
});

test('CLEAR uses the new annual cap and keeps the April reimbursement', async ({ page }) => {
  const clear = page.locator('.benefit-card', { hasText: 'CLEAR Plus' });
  await expect(clear.getByText('Still available: $20.00', { exact: true })).toHaveCount(0);
  await clear.locator('.progress-segment').hover({ position: { x: 20, y: 12 } });
  await expect(page.getByRole('tooltip')).toContainText('Still available: $20.00');
  await expect(page.getByRole('tooltip')).toContainText('$219 from Jul 1, 2026');
  await expect(page.getByRole('tooltip')).toContainText('Earlier credits count toward the same allowance');
});

test('infers an airline from a credited purchase only in the matching year', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('use-your-benefits')!);
    data.cardTransactions['amex-platinum'].transactions.push(
      { date: '2026-08-09', description: 'UNITED AIRLINES WIFI', amount: 8 },
      { date: '2026-08-12', description: 'AMEX Airline Fee Reimbursement', amount: -8 },
    );
    localStorage.setItem('use-your-benefits', JSON.stringify(data));
  });
  await page.reload();
  const airline = page.locator('.benefit-card', { hasText: 'Airline Fee' });
  await expect(airline.getByRole('heading', { name: 'Airline Fee (United Airlines)', exact: true })).toBeVisible();
  const adjacentBar = await page.locator('.benefit-card', { hasText: 'Uber One' }).locator('.progress-bar').boundingBox();
  const airlineBar = await airline.locator('.progress-bar').boundingBox();
  expect(airlineBar!.y).toBeCloseTo(adjacentBar!.y, 0);
  await airline.getByRole('heading', { name: 'Airline Fee (United Airlines)', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Latest credit: Aug 12, 2026');
  await page.getByRole('button', { name: '2025', exact: true }).click();
  await expect(airline.getByRole('heading', { name: 'Airline Fee', exact: true })).toBeVisible();
});

test('shows unused dollars after the 50% target and does not count old Global Entry credits again', async ({ page }) => {
  const resy = page.locator('.benefit-card', { hasText: 'Resy' });
  await expect(resy.locator('.badge-status-completed')).toBeVisible();
  await expect(resy.getByText('Still available: $40.00', { exact: true })).toHaveCount(0);
  await resy.locator('.progress-segment.completed').hover({ position: { x: 20, y: 12 } });
  await expect(page.getByRole('tooltip')).toContainText('Still available: $40.00');
  const entry = page.locator('.benefit-card', { hasText: 'Global Entry/TSA PreCheck' }).first();
  await expect(entry.getByText('$0 / $120', { exact: true })).toBeVisible();
  await expect(entry.getByText(/Credit received in 2025/)).toBeVisible();
  await expect(page.getByText('Remaining', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Still available', { exact: true })).toBeVisible();
});

test('historical views show gray periods before launch', async ({ page }) => {
  await page.getByRole('button', { name: '2024', exact: true }).click();
  const lulu = page.locator('.benefit-card', { hasText: 'lululemon' });
  await expect(lulu.locator('.progress-segment.unavailable')).toHaveCount(4);
  await lulu.locator('.progress-segment').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('Benefit starts Sep 18, 2025');
  await page.getByRole('button', { name: '2025', exact: true }).click();
  await expect(lulu.locator('.progress-segment.unavailable')).toHaveCount(2);
  await expect(lulu.locator('.progress-segment.missed')).toHaveCount(2);
});

test('Chase anniversary settings persist and remove unknown availability', async ({ page }) => {
  const travel = page.locator('.benefit-card').filter({ has: page.getByRole('heading', { name: 'Travel', exact: true }) });
  await expect(travel.getByText(/Set the travel credit reset date/)).toBeVisible();
  await travel.getByLabel('Travel credit reset date').fill('2026-11-10');
  await expect(travel.getByText(/Set the travel credit reset date/)).toHaveCount(0);
  await page.reload();
  await expect(travel.getByLabel('Travel credit reset date')).toHaveValue('2026-11-10');
  await travel.locator('.progress-segment').hover({ position: { x: 20, y: 12 } });
  await expect(page.getByRole('tooltip')).toContainText('Nov 10, 2025 - Nov 9, 2026');
  await expect(page.getByRole('tooltip')).toContainText('Still available: $300.00');
});

test('Chase rollout setting changes historical allowances and persists', async ({ page }) => {
  await page.getByRole('button', { name: '2025', exact: true }).click();
  const dining = page.locator('.benefit-card', { hasText: 'Exclusive Tables Dining' });
  await expect(dining.getByText('$0 / $150', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage benefits' }).nth(1).click();
  await page.getByLabel('2025 benefit rollout').selectOption('new');
  await expect(dining.getByText('$0 / $300', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '2025', exact: true }).click();
  await expect(dining.getByText('$0 / $300', { exact: true })).toBeVisible();
});
