import 'server-only';
import type { EvidenceItem, EvidencePack, MarketView } from '@/shared/types';
import { sha256Hex } from './hash';
import { search } from './tavily';

function keywords(text: string): string {
  const stop = new Set([
    'about',
    'after',
    'before',
    'being',
    'from',
    'have',
    'into',
    'more',
    'must',
    'that',
    'their',
    'there',
    'these',
    'they',
    'this',
    'through',
    'will',
    'with',
    'would',
    'your',
    'keep',
    'kept',
    'broken',
  ]);
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  return [
    ...new Set(
      words.filter((word) => word.length > 2 && !stop.has(word.toLowerCase())),
    ),
  ]
    .slice(0, 8)
    .join(' ');
}

export function buildQueries(
  market: Pick<
    MarketView,
    'promiser' | 'promiseText' | 'criteria' | 'deadline'
  >,
): string[] {
  const nouns = keywords(market.promiseText);
  const year = new Date(market.deadline * 1000).getUTCFullYear();
  return [
    ...new Set([
      `${market.promiser} ${nouns}`.trim(),
      `${market.promiser} ${market.criteria}`.trim(),
      `${nouns} ${year}`.trim(),
    ]),
  ].filter((query) => query.length > 2);
}

export async function gatherEvidence(
  market: Pick<
    MarketView,
    'promiser' | 'promiseText' | 'criteria' | 'deadline'
  >,
): Promise<EvidencePack> {
  const queries = buildQueries(market);
  const batches = await Promise.all(queries.map((query) => search(query)));
  const seen = new Set<string>();
  const items: EvidenceItem[] = [];
  for (const item of batches.flat()) {
    // Paths and query values can be case-sensitive; only URL hosts are folded.
    const url = new URL(item.url);
    url.hash = '';
    const key = url.toString().replace(/\/$/u, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length === 8) break;
  }
  return {
    queries,
    items,
    sha256: sha256Hex(JSON.stringify({ queries, items })),
  };
}
