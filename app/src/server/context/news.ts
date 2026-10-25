// Live "promises in the news" for the home page: recent articles where a public
// figure or organization commits to something by a date. Tavily news search,
// filtered to dated commitments, deduplicated, cached for 30 minutes.
import 'server-only';
import { normalizeText } from './hash';
import { ServiceError } from '../errors';

export interface NewsPromise {
  url: string;
  title: string;
  source: string; // hostname without www.
  snippet: string;
  publishedAt: string | null;
}

const QUERIES = [
  'minister promises project completed by 2027',
  'mayor pledges to open by 2026',
  'governor vows deadline 2027',
  'CEO promises launch by end of year',
  'government commits to deliver by 2030 target',
  'president pledges to finish before end of term',
];
// Social posts and video sites aren't sources the drafter can quote reliably.
const EXCLUDE_DOMAINS = [
  'facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'x.com', 'twitter.com',
  'reddit.com', 'linkedin.com', 'pinterest.com', 'threads.net',
];
// Charity drives also "pledge" money by a year; they're not public commitments to track.
const NOT_A_PROMISE = /\b(donat|fundrais|pledge (?:drive|campaign|goal|card)|stewardship|giving campaign|telethon)/iu;
// A commitment verb, not just "deadline" (trade deadlines, submission deadlines) or "target".
const PROMISE_WORDS = /\b(pledg(?:e|es|ed|ing)\b|promis(?:e|es|ed|ing)\b|vow(?:s|ed)?\b|commit(?:s|ted)? to|will (?:complete|deliver|open|launch|finish|build|cut|reach|end|ban|hire|raise)|ordered (?:the )?completion|sets? (?:a |new )?(?:\w+ )?targets?)/iu;
const DATE_WORDS = /\b(20(2[6-9]|3\d)|by (?:the )?end of|by (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|next year|this year|within \d+ (?:days|weeks|months|years))\b/iu;
const TTL_MS = 30 * 60_000;
const MAX_ITEMS = 8;

type Cache = { at: number; items: NewsPromise[] };
const g = globalThis as typeof globalThis & { __keptNews?: Cache };

async function searchNews(query: string, key: string): Promise<NewsPromise[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, topic: 'news', days: 7, max_results: 10, search_depth: 'basic', exclude_domains: EXCLUDE_DOMAINS }),
  });
  if (!res.ok) throw new Error(`Tavily news returned HTTP ${res.status}`);
  const payload = (await res.json()) as {
    results?: Array<{ url?: unknown; title?: unknown; content?: unknown; published_date?: unknown }>;
  };
  return (payload.results ?? []).flatMap((r): NewsPromise[] => {
    if (typeof r.url !== 'string' || typeof r.title !== 'string' || typeof r.content !== 'string') return [];
    let host: string;
    try {
      const u = new URL(r.url);
      if (!/^https?:$/u.test(u.protocol)) return [];
      host = u.hostname.replace(/^www\./u, '');
    } catch {
      return [];
    }
    return [
      {
        url: r.url,
        title: cleanTitle(normalizeText(r.title)).slice(0, 200),
        source: host,
        snippet: normalizeText(r.content).slice(0, 280),
        publishedAt: typeof r.published_date === 'string' ? r.published_date : null,
      },
    ];
  });
}

/** Keep articles that read like a dated public commitment. Exported for tests. */
export function looksLikeDatedPromise(item: Pick<NewsPromise, 'title' | 'snippet' | 'publishedAt' | 'source'>): boolean {
  const text = `${item.title} ${item.snippet}`;
  if (!item.publishedAt || Number.isNaN(Date.parse(item.publishedAt))) return false;
  if (EXCLUDE_DOMAINS.some((d) => item.source === d || item.source.endsWith(`.${d}`))) return false;
  return PROMISE_WORDS.test(text) && DATE_WORDS.test(text) && !NOT_A_PROMISE.test(text);
}

/** Drop "| Site name" suffixes and "OUTLET - " prefixes from headlines. Exported for tests. */
export function cleanTitle(title: string): string {
  return title
    .replace(/^[A-Z][A-Z .]{2,20}\s+-\s+/u, '') // 'BERNAMA - ' prefix first
    .replace(/\s+\|\s+[^|]{2,40}$/u, '') // ' | Site name' suffix
    .replace(/\s+[–—-]\s+[^–—-]{2,25}$/u, '') // short ' - Site' suffix
    .trim();
}

const words = (t: string) =>
  new Set(t.toLowerCase().replace(/[^a-z0-9 ]/gu, ' ').split(/\s+/u).filter((w) => w.length > 2));

/** One item per URL and per near-identical headline (wire stories syndicate widely). */
export function dedupe(items: NewsPromise[]): NewsPromise[] {
  const kept: { item: NewsPromise; w: Set<string> }[] = [];
  for (const item of items) {
    const w = words(item.title);
    const dup = kept.some((k) => {
      if (k.item.url === item.url) return true;
      const shared = [...w].filter((x) => k.w.has(x)).length;
      return shared / Math.min(w.size, k.w.size || 1) >= 0.7; // same story, reworded
    });
    if (!dup) kept.push({ item, w });
  }
  return kept.map((k) => k.item);
}

export async function promisesInTheNews(fresh = false): Promise<{ items: NewsPromise[]; fetchedAt: number }> {
  if (!fresh && g.__keptNews && Date.now() - g.__keptNews.at < TTL_MS)
    return { items: g.__keptNews.items, fetchedAt: g.__keptNews.at };
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new ServiceError('Live news needs TAVILY_API_KEY on the server.', 'news_not_configured', 503);

  const settled = await Promise.allSettled(QUERIES.map((q) => searchNews(q, key)));
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  if (all.length === 0 && settled.every((s) => s.status === 'rejected'))
    throw new ServiceError('Could not reach the news search right now.', 'news_unavailable', 502);

  const items = dedupe(all.filter(looksLikeDatedPromise))
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
    .slice(0, MAX_ITEMS);
  g.__keptNews = { at: Date.now(), items };
  return { items, fetchedAt: g.__keptNews.at };
}
