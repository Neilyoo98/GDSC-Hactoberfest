import { test, expect } from '@playwright/test';
import { accepted, rejected, sourceText } from '../fixtures/draft';

test('empty clicks show validation and filled clicks send exactly one request', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let requests = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/draft', async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({
      text: sourceText,
      guidance: 'Focus on the promised transit improvements.',
    });
    await waiting;
    await route.fulfill({ json: accepted });
  });
  await page.goto('/create');
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(page.locator('main [role=alert]')).toContainText(
    'Paste a public',
  );
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(sourceText);
  await page
    .getByLabel('Extra guidance for the AI')
    .fill('Focus on the promised transit improvements.');
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Generating AI draft…' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('status').filter({ hasText: 'AI is reviewing your source' }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toBeVisible();
  await expect(page.getByLabel('Promiser', { exact: true })).toHaveValue(
    'Example Transit',
  );
  await expect(page.getByLabel('Deadline', { exact: true })).toHaveValue(
    '2099-12-31',
  );
  await expect(page.getByText('a'.repeat(64))).toHaveCount(0);
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill('Another source');
  await expect(
    page.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toHaveCount(0);
});

test('source failures allow manual text and preserve the source URL', async ({
  page,
}) => {
  const url = 'https://example.com/promise';
  await page.route('**/api/draft', async (route) => {
    const body = route.request().postDataJSON();
    if (!body.text)
      return route.fulfill({
        status: 502,
        json: {
          error: 'Could not read the source.',
          code: 'source_unavailable',
          canPasteSource: true,
        },
      });
    expect(body).toEqual({ url, text: sourceText });
    await route.fulfill({
      json: { ...accepted, source: { ...accepted.source, url } },
    });
  });
  await page.goto('/create');
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(url);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await page.getByLabel('Text copied from the linked page').fill(sourceText);
  await page.getByRole('button', { name: 'Draft from pasted text' }).click();
  await expect(page.getByRole('link', { name: 'Open source' })).toHaveAttribute(
    'href',
    url,
  );
  await expect(
    page.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toBeVisible();
});

test('AI billing failures show the error without an irrelevant extraction fallback', async ({
  page,
}) => {
  await page.route('**/api/draft', (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: 'The API account has no available quota.',
        code: 'ai_quota',
        canPasteSource: false,
      },
    }),
  );
  await page.goto('/create');
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill('https://example.com/promise');
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(page.locator('main [role=alert]')).toContainText(
    'no available quota',
  );
  await expect(page.getByLabel('Text copied from the linked page')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Generate AI draft', exact: true }),
  ).toBeEnabled();
});

test('a rejected promise renders its reason and source', async ({ page }) => {
  await page.route('**/api/draft', (route) =>
    route.fulfill({ json: rejected }),
  );
  await page.goto('/create');
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(rejected.source.text);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Promise not accepted' }),
  ).toBeVisible();
  await expect(page.getByText(rejected.explanation)).toBeVisible();
});

test('malformed API output produces an error instead of a blank/crashed page', async ({
  page,
}) => {
  await page.route('**/api/draft', (route) =>
    route.fulfill({ json: { decision: 'accept', draft: null } }),
  );
  await page.goto('/create');
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(sourceText);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(page.locator('main [role=alert]')).toContainText(
    'invalid draft',
  );
});

test('cancelling a slow request allows another attempt without stale results', async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/draft', async (route) => {
    await waiting;
    await route.fulfill({ json: accepted });
  });
  await page.goto('/create');
  await page
    .getByLabel('Public post URL, article URL, or original text')
    .fill(sourceText);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('main [role=alert]')).toContainText('cancelled');
  release();
  await expect(
    page.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toBeVisible();
});

test('unhydrated pages do not display an enabled but inert generate button', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/create`);
  await expect(
    page.getByRole('button', { name: 'Loading form…' }),
  ).toBeDisabled();
  await expect(page.locator('main [role=alert]')).toContainText(
    'JavaScript is required',
  );
  await context.close();
});

test('the create form works inside a sandboxed VS Code-style iframe', async ({
  page,
  baseURL,
}) => {
  await page.route('**/api/draft', (route) =>
    route.fulfill({ json: accepted }),
  );
  await page.setContent(
    `<iframe src="${baseURL}/create" sandbox="allow-scripts allow-forms allow-same-origin allow-downloads" style="width:100%;height:900px"></iframe>`,
  );
  const frame = page.frameLocator('iframe');
  await frame
    .getByLabel('Public post URL, article URL, or original text')
    .fill(sourceText);
  await frame
    .getByRole('button', { name: 'Generate AI draft', exact: true })
    .click();
  await expect(
    frame.getByRole('heading', { name: '02 / Review AI draft' }),
  ).toBeVisible();
});

for (const path of [
  '/',
  '/council',
  '/faucet',
  '/leaderboard',
  '/markets/1',
  '/promisers/maryland-transit',
]) {
  test(`page smoke check: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('unknown market and promiser return 404', async ({ page }) => {
  expect((await page.goto('/markets/999999'))?.status()).toBe(404);
  expect((await page.goto('/promisers/does-not-exist'))?.status()).toBe(404);
});
