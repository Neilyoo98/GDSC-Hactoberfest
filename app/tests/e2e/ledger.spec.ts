// OWNER: P3
import { test, expect } from '@playwright/test';
import { accepted, sourceText } from '../fixtures/draft';
test('filter a promise and inspect its prediction estimate', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.market-card')).toHaveCount(6);
  const promises = await page.locator('.market-card .quote').allTextContents();
  expect(new Set(promises).size).toBe(6);
  const promisers = await page
    .locator('.market-card .promiser')
    .allTextContents();
  expect(new Set(promisers).size).toBe(6);
  await page.getByLabel('Filter promises').selectOption('Open');
  await expect(page.locator('.market-card')).toHaveCount(1);
  await page.locator('.market-card .quote').click();
  await page.getByRole('button', { name: '✕ Broken', exact: true }).click();
  await page.getByRole('spinbutton').fill('101');
  await expect(
    page.getByText('Enter an amount from 1 to 100.', { exact: true }),
  ).toContainText('1 to 100');
  await page.getByRole('spinbutton').fill('10');
  await expect(page.locator('.amount')).toContainText('31.43');
  await expect(
    page.getByRole('button', { name: 'Confirm prediction' }),
  ).toBeDisabled();
});
test('review an editable sample without submitting a transaction', async ({
  page,
}) => {
  await page.route('**/api/draft', (route) =>
    route.fulfill({ json: accepted }),
  );
  await page.goto('/create');
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(sourceText);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await page.getByLabel('Exact promise').fill('A sample commitment.');
  await expect(page.getByText('20/240')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create on Solana' }),
  ).toBeDisabled();
});
