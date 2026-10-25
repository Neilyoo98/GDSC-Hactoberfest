// OWNER: P3
import { test, expect } from '@playwright/test';
import { accepted, sourceText } from '../fixtures/draft';
test('AI answer reveals editable fields and fits a mobile screen', async ({
  page,
}) => {
  await page.route('**/api/draft', (route) =>
    route.fulfill({ json: accepted }),
  );
  await page.goto('/create');
  await expect(
    page.getByRole('button', { name: 'Preview a sample answer' }),
  ).toHaveCount(0);
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(sourceText);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toBeVisible();
  await expect(page.getByLabel('Promiser', { exact: true })).toHaveValue(
    accepted.draft!.promiser,
  );
  await page.getByLabel('Promiser', { exact: true }).fill('Edited promiser');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByLabel('Deadline', { exact: true })).toBeVisible();
});
