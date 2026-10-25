import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/app/api/draft/route';
import { draftMarket } from '../../src/server/intelligence/drafter';
import { fetchXPost } from '../../src/server/context/oembed';
import { extractArticle as extract } from '../../src/server/context/article';
import { accepted, sourceText } from '../fixtures/draft';
import { ServiceError } from '../../src/server/errors';

vi.mock('../../src/server/intelligence/drafter', () => ({
  draftMarket: vi.fn(),
}));
vi.mock('../../src/server/context/oembed', () => ({ fetchXPost: vi.fn() }));
vi.mock('../../src/server/context/article', () => ({
  extractArticle: vi.fn(),
}));
const request = (body: unknown) =>
  new Request('http://localhost/api/draft', {
    method: 'POST',
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.mocked(draftMarket).mockReset().mockResolvedValue(accepted);
  vi.mocked(fetchXPost).mockReset().mockResolvedValue(accepted.source);
  vi.mocked(extract).mockReset().mockResolvedValue(accepted.source);
});
describe('POST /api/draft', () => {
  it.each([
    {},
    { text: '' },
    { text: ' ' },
    { text: 'a'.repeat(20001) },
    { url: 'ftp://example.com' },
    { url: 'https://user:secret@example.com' },
    {
      url: `https://www.epa.gov/sustainable-water-infrastructure/tijuana-river-watershed-public-updates${'%20suitable%20market%20would%20be%20this%20text'.repeat(6)}`,
    },
    { url: 'bad' },
    { text: 'valid', extra: true },
  ])('rejects invalid input case %# before provider calls', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(draftMarket).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
  });
  it('rejects broken JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/draft', { method: 'POST', body: '{' }),
    );
    expect(response.status).toBe(400);
  });
  it('drafts pasted text without extraction', async () => {
    const response = await POST(request({ text: sourceText }));
    expect(await response.json()).toEqual(accepted);
    expect(extract).not.toHaveBeenCalled();
    expect(draftMarket).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'text', text: sourceText }),
      undefined,
      expect.any(AbortSignal),
      undefined,
    );
  });
  it('passes optional user guidance to the drafter separately from source data', async () => {
    await POST(
      request({
        text: sourceText,
        guidance: 'Focus on the transit improvements.',
      }),
    );
    expect(draftMarket).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'text', text: sourceText }),
      undefined,
      expect.any(AbortSignal),
      'Focus on the transit improvements.',
    );
  });
  it('keeps attribution when pasted text bypasses an unreadable URL', async () => {
    await POST(
      request({ text: sourceText, url: 'https://example.com/promise' }),
    );
    expect(extract).not.toHaveBeenCalled();
    expect(draftMarket).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'text',
        url: 'https://example.com/promise',
        text: sourceText,
      }),
      undefined,
      expect.any(AbortSignal),
      undefined,
    );
  });
  it.each([
    'https://x.com/gov/status/123',
    'https://www.twitter.com/gov/status/123',
  ])('routes X source %s to oEmbed', async (url) => {
    await POST(request({ url }));
    expect(fetchXPost).toHaveBeenCalledWith(url, expect.any(AbortSignal));
    expect(extract).not.toHaveBeenCalled();
  });
  it('does not mistake an X URL inside an article path for an X post', async () => {
    const url = 'https://example.com/x.com/gov/status/123';
    await POST(request({ url }));
    expect(extract).toHaveBeenCalledWith(url, expect.any(AbortSignal));
  });
  it('offers manual text only for extraction failures', async () => {
    vi.mocked(extract).mockRejectedValue(
      new Error('internal provider details'),
    );
    const response = await POST(
      request({ url: 'https://example.com/promise' }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'source_unavailable',
      canPasteSource: true,
    });
    expect(draftMarket).not.toHaveBeenCalled();
  });
  it('does not suggest pasted text for AI billing failures', async () => {
    vi.mocked(draftMarket).mockRejectedValue(
      new ServiceError('No quota.', 'ai_quota', 429),
    );
    const response = await POST(
      request({ url: 'https://example.com/promise' }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'No quota.',
      code: 'ai_quota',
      canPasteSource: false,
    });
  });
  it('does not expose arbitrary exception text', async () => {
    vi.mocked(draftMarket).mockRejectedValue(
      new Error('secret-internal-detail'),
    );
    const response = await POST(request({ text: sourceText }));
    expect(await response.text()).not.toContain('secret-internal-detail');
  });
});
