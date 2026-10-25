import { expect, it, vi } from 'vitest';
import { draftPromise } from './apiClient';
import { accepted } from '../../tests/fixtures/draft';
it('validates successful drafts', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json(accepted));
  expect(await draftPromise({ text: 'Promise' })).toEqual(accepted);
});
it.each([null, {}, { ...accepted, draft: null }])(
  'rejects invalid successful payload %j instead of crashing the page',
  async (body) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(body));
    await expect(draftPromise({ text: 'Promise' })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  },
);
it('preserves structured fallback information', async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      {
        error: 'Paste text.',
        code: 'source_unavailable',
        canPasteSource: true,
      },
      { status: 502 },
    ),
  );
  await expect(
    draftPromise({ url: 'https://example.com' }),
  ).rejects.toMatchObject({
    message: 'Paste text.',
    status: 502,
    canPasteSource: true,
  });
});
it('reports a non-JSON server response', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('<html>Server error</html>', { status: 500 }),
  );
  await expect(draftPromise({ text: 'Promise' })).rejects.toMatchObject({
    code: 'invalid_response',
  });
});
it('reports an unreachable server', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(draftPromise({ text: 'Promise' })).rejects.toMatchObject({
    code: 'network_error',
  });
});
it('reports a bounded request timeout', async () => {
  vi.mocked(fetch).mockRejectedValue(
    new DOMException('Timed out.', 'TimeoutError'),
  );
  await expect(draftPromise({ text: 'Promise' })).rejects.toMatchObject({
    code: 'request_timeout',
  });
});
