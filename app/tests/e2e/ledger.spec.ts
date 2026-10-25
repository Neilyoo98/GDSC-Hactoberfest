// OWNER: P3
import { test, expect } from '@playwright/test';
test('filter a promise and inspect its prediction estimate', async ({
  page,
}) => {
  await page.goto('/');
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
    page.getByRole('button', { name: 'Connect wallet to predict' }),
  ).toBeDisabled();
});
test('review an editable sample without submitting a transaction', async ({
  page,
}) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Load sample draft' }).click();
  await page.getByLabel('Exact promise').fill('A sample commitment.');
  await expect(page.getByText('20/240')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create on Solana' }),
  ).toBeDisabled();
});
