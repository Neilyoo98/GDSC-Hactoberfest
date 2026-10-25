import 'server-only';
import type { SourceDoc } from '@/shared/types';
import { normalizeText, sha256Hex } from './hash';

const MAX_TEXT_CHARS = 20_000;

export function sourceFromText(
  input: string,
  sourceUrl: string | null = null,
): SourceDoc {
  const text = normalizeText(input).slice(0, MAX_TEXT_CHARS);
  if (!text) throw new Error('Source text cannot be empty.');
  let url: URL | null = null;
  if (sourceUrl) {
    url = new URL(sourceUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('Source URL must use HTTP or HTTPS.');
    url.hash = '';
  }
  const hostname = url?.hostname.toLowerCase().replace(/^www\./u, '') ?? null;
  return {
    // A supplied URL is attribution, not proof that we retrieved the page.
    kind: 'text',
    url: url?.toString() ?? null,
    author: hostname,
    authorUrl: url ? `${url.protocol}//${url.host}` : null,
    text,
    publishedAt: null,
    sha256: sha256Hex(text),
  };
}
