import 'server-only';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { SourceDoc } from '@/shared/types';
import { normalizeText, sha256Hex } from './hash';
import { fetchPublicPage } from './publicPage';
import { extract } from './tavily';
import { ServiceError } from '../errors';

export function readableText(text: string): boolean {
  return text.length >= 100 && text.split(/\s+/u).length >= 15;
}

function validatePageContent(url: string, text: string): void {
  const parsed = new URL(url);
  const lower = text.toLowerCase();
  const errorPage =
    /(?:this web page does not exist|the page you requested (?:could not be found|was not found)|the requested page (?:could not be found|does not exist)|we (?:could not|cannot|can.t) find (?:the page|what you are looking for)|access denied|request rejected|403 forbidden|404 not found|service unavailable)/iu;
  if (text.length < 4_000 && errorPage.test(text)) {
    throw new ServiceError(
      'The site returned an error page instead of the requested article.',
      'source_error_page',
    );
  }
  // EPA sometimes returns readable error documents for this page URL. Ensure
  // the fetched body actually discusses the river named by the requested page.
  if (
    parsed.hostname === 'www.epa.gov' &&
    parsed.pathname.startsWith(
      '/sustainable-water-infrastructure/tijuana-river-watershed-public-updates',
    ) &&
    (!lower.includes('tijuana') || !lower.includes('river'))
  ) {
    throw new ServiceError(
      'EPA returned a page that does not contain the Tijuana River updates.',
      'source_page_mismatch',
    );
  }
}

/** Parse inert HTML. Scripts, embeds and fetched subresources are never run. */
export function articleFromHtml(html: string, url: string): SourceDoc {
  const { document } = parseHTML(html);
  if (
    /^(access denied|just a moment|attention required|verify you are human|robot or human)/iu.test(
      document.title.trim(),
    )
  ) {
    throw new ServiceError(
      'The site returned an access-check page.',
      'source_unavailable',
    );
  }
  const publishedAt =
    document
      .querySelector(
        'meta[property="article:published_time"], meta[name="date"]',
      )
      ?.getAttribute('content') ?? null;
  document
    .querySelectorAll(
      'script, style, noscript, iframe, nav, header, footer, form, [hidden], [aria-hidden="true"]',
    )
    .forEach((node) => node.remove());
  // Keep word boundaries in headings, tables and lists as well as paragraphs.
  document
    .querySelectorAll('p, li, h1, h2, h3, h4, td, th, br, div, section')
    .forEach((node) => node.appendChild(document.createTextNode('\n')));
  const main = document.querySelector('main, [role="main"], article');
  const mainText = normalizeText(main?.textContent ?? '');
  const article = new Readability(document, {
    charThreshold: 100,
    maxElemsToParse: 30_000,
  }).parse();
  const extracted = normalizeText(article?.textContent ?? '');
  const text = (readableText(extracted) ? extracted : mainText).slice(
    0,
    20_000,
  );
  if (!readableText(text))
    throw new ServiceError(
      'The page did not contain readable article text.',
      'source_unavailable',
    );
  validatePageContent(url, text);
  const parsed = new URL(url);
  return {
    kind: 'article',
    url,
    author: article?.byline || parsed.hostname,
    authorUrl: parsed.origin,
    text,
    publishedAt,
    sha256: sha256Hex(text),
  };
}

export async function extractArticle(
  url: string,
  signal?: AbortSignal,
): Promise<SourceDoc> {
  let directError: unknown;
  try {
    const page = await fetchPublicPage(url, signal);
    if (/^text\/plain(?:;|$)/iu.test(page.contentType)) {
      const text = normalizeText(page.body).slice(0, 20_000);
      if (!readableText(text))
        throw new ServiceError(
          'The page contains too little source text.',
          'source_unavailable',
        );
      validatePageContent(page.url, text);
      const parsed = new URL(page.url);
      return {
        kind: 'article',
        url: page.url,
        author: parsed.hostname,
        authorUrl: parsed.origin,
        text,
        publishedAt: null,
        sha256: sha256Hex(text),
      };
    }
    return articleFromHtml(page.body, page.url);
  } catch (error) {
    signal?.throwIfAborted();
    // Invalid/private URLs are never forwarded to another fetching service.
    if (error instanceof ServiceError && error.code === 'source_url_blocked')
      throw error;
    directError = error;
  }
  const providers = new AbortController();
  const providerSignal = signal
    ? AbortSignal.any([signal, providers.signal])
    : providers.signal;
  const attempts = [
    extractWithTavily(url, providerSignal),
    extractWithTextReader(url, providerSignal),
  ];
  try {
    // Tavily and the independent text reader race after the direct fetch fails.
    // A slow provider can't prevent a faster one from producing readable text.
    return await Promise.any(attempts);
  } catch {
    signal?.throwIfAborted();
    const detail =
      directError instanceof ServiceError &&
      directError.code === 'source_unavailable'
        ? 'The page did not allow direct reading.'
        : 'The direct page request failed.';
    throw new ServiceError(
      `${detail} Tavily and the public text reader also failed. The site may require sign-in, block automated access, or be unavailable. You can paste the source text below.`,
      'source_unavailable',
    );
  } finally {
    providers.abort();
  }
}

async function extractWithTavily(
  url: string,
  signal: AbortSignal,
): Promise<SourceDoc> {
  const source = await extract(url, signal);
  if (!readableText(source.text)) throw new Error('Empty Tavily extraction.');
  validatePageContent(source.url ?? url, source.text);
  return source;
}

async function extractWithTextReader(
  url: string,
  parentSignal: AbortSignal,
): Promise<SourceDoc> {
  const sourceUrl = new URL(url);
  const signal = AbortSignal.any([AbortSignal.timeout(20_000), parentSignal]);
  let response: Response;
  try {
    response = await fetch(`https://r.jina.ai/${sourceUrl.toString()}`, {
      signal,
      headers: { accept: 'text/plain', 'x-respond-with': 'markdown' },
    });
  } catch (error) {
    if (parentSignal.aborted) throw parentSignal.reason;
    throw new ServiceError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The public text reader timed out.'
        : 'The public text reader could not connect.',
      'source_reader_unavailable',
    );
  }
  if (!response.ok)
    throw new ServiceError(
      'The public text reader could not read this URL.',
      'source_reader_unavailable',
    );
  if (Number(response.headers.get('content-length')) > 2_000_000)
    throw new ServiceError(
      'The public text reader response is too large.',
      'source_too_large',
    );
  if (!response.body)
    throw new ServiceError(
      'The public text reader returned no content.',
      'source_unavailable',
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) {
        await reader.cancel();
        throw new ServiceError(
          'The public text reader response is too large.',
          'source_too_large',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const text = normalizeText(
    new TextDecoder().decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    ),
  ).slice(0, 20_000);
  if (!readableText(text))
    throw new ServiceError(
      'The public text reader returned no readable article text.',
      'source_unavailable',
    );
  validatePageContent(url, text);
  return {
    kind: 'article',
    url: sourceUrl.toString(),
    author: sourceUrl.hostname,
    authorUrl: sourceUrl.origin,
    text,
    publishedAt: null,
    sha256: sha256Hex(text),
  };
}
