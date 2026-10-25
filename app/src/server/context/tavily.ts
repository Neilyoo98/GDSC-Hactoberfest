import 'server-only';
import type { EvidenceItem, SourceDoc } from '@/shared/types';
import { normalizeText, sha256Hex } from './hash';
import { ServiceError } from '../errors';
import { HttpUrlSchema } from '@/shared/draftSchemas';

const API_URL = 'https://api.tavily.com';
const MAX_TEXT = 20_000;

function apiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key?.trim())
    throw new ServiceError(
      'Source retrieval is not configured. Paste source text, or configure TAVILY_API_KEY on the server.',
      'source_not_configured',
      503,
    );
  return key;
}

export async function search(query: string): Promise<EvidenceItem[]> {
  const response = await fetch(`${API_URL}/search`, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey(),
      query: normalizeText(query).slice(0, 400),
      search_depth: 'advanced',
      max_results: 5,
      topic: 'news',
    }),
  });
  if (!response.ok)
    throw new Error(`Tavily search returned HTTP ${response.status}.`);
  const payload = (await response.json()) as {
    results?: Array<{
      url?: unknown;
      title?: unknown;
      content?: unknown;
      published_date?: unknown;
    }>;
  };
  return (payload.results ?? []).flatMap((item): EvidenceItem[] => {
    if (
      !HttpUrlSchema.safeParse(item.url).success ||
      typeof item.url !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.content !== 'string' ||
      !item.content.trim()
    )
      return [];
    return [
      {
        url: item.url,
        title: normalizeText(item.title).slice(0, 300),
        snippet: normalizeText(item.content).slice(0, 1200),
        publishedAt:
          typeof item.published_date === 'string' ? item.published_date : null,
      },
    ];
  });
}

export async function extract(
  url: string,
  signal?: AbortSignal,
): Promise<SourceDoc> {
  const parsed = new URL(url);
  if (!/^https?:$/u.test(parsed.protocol))
    throw new Error('Only http and https article URLs can be extracted.');
  const response = await fetch(`${API_URL}/extract`, {
    method: 'POST',
    signal: AbortSignal.any([
      AbortSignal.timeout(35_000),
      ...(signal ? [signal] : []),
    ]),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey(),
      urls: [parsed.toString()],
      extract_depth: 'advanced',
      format: 'text',
      timeout: 30,
    }),
  });
  if (!response.ok)
    throw new ServiceError(
      'The article service could not read this URL. Paste the relevant text from the page instead.',
      'source_unavailable',
    );
  const payload = (await response.json()) as {
    results?: Array<{
      url?: unknown;
      raw_content?: unknown;
      content?: unknown;
    }>;
  };
  const result = payload.results?.[0];
  const raw =
    typeof result?.raw_content === 'string'
      ? result.raw_content
      : result?.content;
  if (typeof raw !== 'string' || !normalizeText(raw))
    throw new ServiceError(
      'Tavily could not extract readable article text. Paste the relevant text from the linked page below.',
      'source_unavailable',
    );
  const text = normalizeText(raw).slice(0, MAX_TEXT);
  return {
    kind: 'article',
    url: parsed.toString(),
    author: parsed.hostname,
    authorUrl: `${parsed.protocol}//${parsed.host}`,
    text,
    publishedAt: null,
    sha256: sha256Hex(text),
  };
}
