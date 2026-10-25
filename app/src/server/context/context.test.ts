import { describe, expect, it, vi } from 'vitest';
import { sourceFromText } from './source';
import { normalizeText, sha256Hex } from './hash';
import { fetchXPost } from './oembed';
import { extract, search } from './tavily';
import { gatherEvidence } from './evidence';
import { market } from '../../../tests/fixtures/draft';

describe('source context', () => {
  it('normalizes and fingerprints the same text consistently', () => {
    expect(normalizeText('Ａ  promise\n')).toBe('A promise');
    expect(sha256Hex('Ａ  promise\n')).toBe(sha256Hex('A promise'));
    expect(sha256Hex('A different promise')).not.toBe(sha256Hex('A promise'));
  });
  it('keeps a URL on a manually supplied source without claiming retrieval', () => {
    const doc = sourceFromText(
      '  Original   words ',
      'https://example.com/promise#section',
    );
    expect(doc).toMatchObject({
      kind: 'text',
      text: 'Original words',
      url: 'https://example.com/promise',
      sha256: sha256Hex('Original words'),
    });
  });
  it('rejects empty source text', () =>
    expect(() => sourceFromText(' \n')).toThrow());
  it('decodes X HTML including malformed entities without crashing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        html: '<blockquote><p>We &amp; you<br>will act. &#x1F68C; &#999999999;</p>Author footer</blockquote>',
        author_name: 'Public office',
      }),
    );
    const doc = await fetchXPost('https://x.com/gov/status/123?s=20');
    expect(doc.text).toBe('We & you will act. 🚌 �');
    expect(doc.url).toBe('https://x.com/gov/status/123');
    expect(doc.sha256).toBe(sha256Hex(doc.text));
  });
  it('rejects non-post X URLs before fetching', async () => {
    await expect(fetchXPost('https://x.com/gov')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reports an extraction failure with a stable error code', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-only');
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ results: [], failed_results: [{ error: 'unreadable' }] }),
    );
    await expect(extract('https://example.com/article')).rejects.toMatchObject({
      code: 'source_unavailable',
    });
  });
  it('hashes extracted text and keeps the requested attribution URL', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-only');
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        results: [
          { raw_content: ' Clear\n promise ', url: 'javascript:alert(1)' },
        ],
      }),
    );
    expect(await extract('https://example.com/article')).toMatchObject({
      text: 'Clear promise',
      sha256: sha256Hex('Clear promise'),
      url: 'https://example.com/article',
    });
  });
  it('filters unsafe and unreadable search results', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-only');
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        results: [
          { url: 'javascript:alert(1)', title: 'Unsafe', content: 'Text' },
          { url: 'https://example.com/empty', title: 'Empty', content: ' ' },
          {
            url: 'https://example.com/report',
            title: 'Report',
            content: 'Facts',
          },
        ],
      }),
    );
    expect(await search('query')).toEqual([
      {
        url: 'https://example.com/report',
        title: 'Report',
        snippet: 'Facts',
        publishedAt: null,
      },
    ]);
  });
  it('deduplicates fragments while preserving case-sensitive paths', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-only');
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({
        results: [
          {
            url: 'https://example.com/Report#first',
            title: 'A',
            content: 'Facts',
          },
          {
            url: 'https://example.com/Report#second',
            title: 'A',
            content: 'Facts',
          },
          {
            url: 'https://example.com/report',
            title: 'B',
            content: 'Other facts',
          },
        ],
      }),
    );
    const pack = await gatherEvidence(market);
    expect(pack.items).toHaveLength(2);
    expect(pack.sha256).toBe(
      sha256Hex(JSON.stringify({ queries: pack.queries, items: pack.items })),
    );
  });
});
