import { beforeEach, describe, expect, it, vi } from 'vitest';
import { articleFromHtml, extractArticle } from './article';
import { fetchPublicPage } from './publicPage';
import { extract } from './tavily';
import { ServiceError } from '../errors';
import { sha256Hex } from './hash';

vi.mock('./publicPage', () => ({ fetchPublicPage: vi.fn() }));
vi.mock('./tavily', () => ({ extract: vi.fn() }));
const url = 'https://example.com/public-updates';
const paragraph =
  'The public agency will complete the new water treatment facility by November 2027. Construction has started, and quarterly public reports will track completion of this project.';
const html = `<html><head><title>Watershed updates</title><meta property="article:published_time" content="2026-09-30"></head><body><nav>Navigation junk</nav><main><h1>Watershed updates</h1><p>${paragraph}</p><ul><li>Phase one was completed in August 2026.</li><li>Phase two will finish by December 2027.</li></ul></main><footer>Footer junk</footer><script>throw new Error('Do not execute');</script></body></html>`;
beforeEach(() => {
  vi.mocked(fetchPublicPage).mockReset();
  vi.mocked(extract).mockReset();
});

describe('direct article reader', () => {
  it('extracts body paragraphs and list deadlines, excluding navigation and executable content', () => {
    const doc = articleFromHtml(html, url);
    expect(doc.text).toContain(paragraph);
    expect(doc.text).toContain('Phase two will finish by December 2027.');
    expect(doc.text).not.toMatch(/Navigation junk|Footer junk|Do not execute/u);
    expect(doc.publishedAt).toBe('2026-09-30');
    expect(doc.sha256).toBe(sha256Hex(doc.text));
  });
  it('maintains word boundaries between adjacent blocks and decodes entities', () => {
    const doc = articleFromHtml(
      `<html><body><main><h1>Updates</h1><p>${paragraph}</p><p>Water &amp; infrastructure</p><p>Next paragraph.</p></main></body></html>`,
      url,
    );
    expect(doc.text).toContain('Water & infrastructure Next paragraph.');
  });
  it('rejects challenge pages and empty JavaScript shells', () => {
    expect(() =>
      articleFromHtml(
        '<html><head><title>Just a moment...</title></head><body>Please verify</body></html>',
        url,
      ),
    ).toThrow();
    expect(() =>
      articleFromHtml(
        '<html><body><div id="app"></div><script>loadContent()</script></body></html>',
        url,
      ),
    ).toThrow();
  });
  it('rejects readable server error templates instead of treating them as source', () => {
    const error = `<html><body><main><h1>Page unavailable</h1><p>The page you requested could not be found. ${'Please return to the EPA home page for other public information. '.repeat(5)}</p></main></body></html>`;
    expect(() => articleFromHtml(error, url)).toThrow(/error page/u);
  });
  it('rejects the EPA page-not-found notice as source evidence', () => {
    const epaUrl =
      'https://www.epa.gov/sustainable-water-infrastructure/tijuana-river-watershed-public-updates';
    const error = `<html><body><main><h1>Sorry, but this web page does not exist.</h1><p>${'The EPA wants to help you find what you are looking for. '.repeat(8)}</p></main></body></html>`;
    expect(() => articleFromHtml(error, epaUrl)).toThrow();
  });
  it('rejects an unrelated EPA page and automatically uses matching fallback content', async () => {
    const epaUrl =
      'https://www.epa.gov/sustainable-water-infrastructure/tijuana-river-watershed-public-updates';
    const error = `<html><body><main><h1>General agency information</h1><p>${'The Environmental Protection Agency provides public information and community resources. '.repeat(5)}</p></main></body></html>`;
    vi.mocked(fetchPublicPage).mockResolvedValue({
      body: error,
      url: epaUrl,
      contentType: 'text/html',
    });
    const matching = articleFromHtml(
      `<html><body><main><h1>Tijuana River Watershed Public Updates</h1><p>${paragraph} ${'EPA and SEMARNAT are publishing quarterly updates on the Tijuana River watershed. '.repeat(4)}</p></main></body></html>`,
      epaUrl,
    );
    vi.mocked(extract).mockResolvedValue(matching);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Reader unavailable')),
    );
    const source = await extractArticle(epaUrl);
    expect(source.text).toContain('Tijuana River');
    expect(extract).toHaveBeenCalledOnce();
  });
  it('reads a URL without Tavily or a Tavily key when HTML is available', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    vi.mocked(fetchPublicPage).mockResolvedValue({
      body: html,
      url,
      contentType: 'text/html',
    });
    const doc = await extractArticle(url);
    expect(doc.kind).toBe('article');
    expect(doc.text).toContain('November 2027');
    expect(extract).not.toHaveBeenCalled();
  });
  it('automatically falls back to Tavily after a direct fetch failure', async () => {
    vi.mocked(fetchPublicPage).mockRejectedValue(new Error('HTTP 403'));
    const doc = articleFromHtml(html, url);
    vi.mocked(extract).mockResolvedValue(doc);
    expect(await extractArticle(url)).toEqual(doc);
    expect(extract).toHaveBeenCalledWith(url, expect.any(AbortSignal));
  });
  it('uses Tavily for a JavaScript shell without asking the user to paste text', async () => {
    vi.mocked(fetchPublicPage).mockResolvedValue({
      body: '<html><body>Loading...</body></html>',
      url,
      contentType: 'text/html',
    });
    vi.mocked(extract).mockResolvedValue(articleFromHtml(html, url));
    expect((await extractArticle(url)).text).toContain('November 2027');
  });
  it('uses the independent text reader when Tavily fails', async () => {
    vi.mocked(fetchPublicPage).mockRejectedValue(
      new Error('Direct fetch failed'),
    );
    vi.mocked(extract).mockRejectedValue(new Error('Tavily failed'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(paragraph, { status: 200 })),
    );
    const source = await extractArticle(url);
    expect(source.text).toBe(paragraph);
    expect(source.sha256).toBe(sha256Hex(paragraph));
    expect(fetch).toHaveBeenCalledWith(
      `https://r.jina.ai/${url}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it('returns the first provider with readable text and cancels the slower provider', async () => {
    vi.mocked(fetchPublicPage).mockRejectedValue(
      new Error('Direct fetch failed'),
    );
    vi.mocked(extract).mockResolvedValue(articleFromHtml(html, url));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const source = await extractArticle(url);
    expect(source.text).toContain('November 2027');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('supports plain text source pages', async () => {
    vi.mocked(fetchPublicPage).mockResolvedValue({
      body: paragraph,
      url,
      contentType: 'text/plain; charset=utf-8',
    });
    expect(await extractArticle(url)).toMatchObject({
      text: paragraph,
      url,
      sha256: sha256Hex(paragraph),
    });
  });
  it('only offers manual text after both automatic readers fail', async () => {
    vi.mocked(fetchPublicPage).mockRejectedValue(new Error('Unavailable'));
    vi.mocked(extract).mockRejectedValue(new Error('Provider failed'));
    await expect(extractArticle(url)).rejects.toMatchObject({
      code: 'source_unavailable',
    });
    expect(extract).toHaveBeenCalledOnce();
  });
  it('does not forward blocked URLs to Tavily', async () => {
    vi.mocked(fetchPublicPage).mockRejectedValue(
      new ServiceError('Blocked.', 'source_url_blocked', 400),
    );
    await expect(
      extractArticle('http://127.0.0.1/private'),
    ).rejects.toMatchObject({ code: 'source_url_blocked' });
    expect(extract).not.toHaveBeenCalled();
  });
  it('does not start another provider request after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.mocked(fetchPublicPage).mockRejectedValue(controller.signal.reason);
    await expect(extractArticle(url, controller.signal)).rejects.toThrow();
    expect(extract).not.toHaveBeenCalled();
  });
});
