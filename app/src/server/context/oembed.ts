import 'server-only';
import type { SourceDoc } from '@/shared/types';
import { normalizeText, sha256Hex } from './hash';

const OEMBED_ENDPOINT = 'https://publish.twitter.com/oembed';
const X_POST_URL =
  /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[\w]{1,30}\/status\/\d+(?:[/?#].*)?$/iu;
const MAX_SOURCE_CHARS = 20_000;

interface OEmbedResponse {
  html?: unknown;
  author_name?: unknown;
  author_url?: unknown;
}

function codePoint(value: number): string {
  return Number.isInteger(value) &&
    value >= 0 &&
    value <= 0x10ffff &&
    !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value)
    : '\uFFFD';
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&#(\d+);/gu, (_, n: string) => codePoint(Number(n)))
    .replace(/&#x([\da-f]+);/giu, (_, n: string) =>
      codePoint(Number.parseInt(n, 16)),
    );
}

function htmlToPost(html: string): {
  text: string;
  publishedAt: string | null;
} {
  const timeMatch = html.match(/<time\b[^>]*datetime=["']([^"']+)["']/iu);
  const paragraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/iu)?.[1] ?? html;
  const text = decodeHtml(
    paragraph.replace(/<br\s*\/?>/giu, ' ').replace(/<[^>]*>/gu, ' '),
  );
  return {
    text: normalizeText(text).slice(0, MAX_SOURCE_CHARS),
    publishedAt: timeMatch?.[1] ?? null,
  };
}

export async function fetchXPost(
  url: string,
  signal?: AbortSignal,
): Promise<SourceDoc> {
  if (!X_POST_URL.test(url))
    throw new Error('Provide a public X or Twitter post URL.');
  const canonicalUrl = new URL(url);
  canonicalUrl.search = '';
  canonicalUrl.hash = '';
  const endpoint = new URL(OEMBED_ENDPOINT);
  endpoint.searchParams.set('url', canonicalUrl.toString());
  endpoint.searchParams.set('omit_script', '1');
  endpoint.searchParams.set('dnt', 'true');

  const response = await fetch(endpoint, {
    signal: AbortSignal.any([
      AbortSignal.timeout(10_000),
      ...(signal ? [signal] : []),
    ]),
    headers: { accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error(`X oEmbed returned HTTP ${response.status}.`);
  const payload = (await response.json()) as OEmbedResponse;
  if (typeof payload.html !== 'string')
    throw new Error('X oEmbed did not return post content.');
  const { text, publishedAt } = htmlToPost(payload.html);
  if (!text) throw new Error('The post has no readable text.');
  return {
    kind: 'x_post',
    url: canonicalUrl.toString(),
    author:
      typeof payload.author_name === 'string'
        ? normalizeText(payload.author_name).slice(0, 120)
        : null,
    authorUrl:
      typeof payload.author_url === 'string' ? payload.author_url : null,
    text,
    publishedAt,
    sha256: sha256Hex(text),
  };
}
