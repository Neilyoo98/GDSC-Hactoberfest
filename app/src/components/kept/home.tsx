'use client';
// OWNER: P3. Home page live pieces: on-chain stats and promises in this week's news.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMarkets } from '@/chain/hooks';
import type { MarketView } from '@/shared/types';
import { isListed, MarketList } from './ledger';

interface NewsPromise {
  url: string;
  title: string;
  source: string;
  snippet: string;
  publishedAt: string | null;
}

/** Stats + ledger share ONE market poll: public devnet RPC rate-limits getProgramAccounts. */
export function HomeBoard({ rail }: { rail: React.ReactNode }) {
  const { data, error, loading } = useMarkets();
  return (
    <>
      <StatsStrip data={data} />
      <div className="front">
        <section aria-labelledby="record-heading">
          <h2 id="record-heading" className="section-title">
            On the record
          </h2>
          <MarketList markets={data} error={error} loading={loading} />
        </section>
        {rail}
      </div>
    </>
  );
}

export function StatsStrip({ data }: { data: MarketView[] | undefined }) {
  const markets = (data ?? []).filter(isListed);
  const staked = markets.reduce((s, m) => s + m.totals.kept + m.totals.broken, 0);
  const open = markets.filter((m) => m.status === 'open').length;
  const settled = markets.filter((m) => m.status === 'finalized' || m.status === 'void').length;
  const stats = [
    { label: 'promises on record', value: data ? markets.length : '—' },
    { label: 'open for predictions', value: data ? open : '—' },
    { label: 'settled on-chain', value: data ? settled : '—' },
    { label: 'tUSDC staked', value: data ? staked.toLocaleString('en-US') : '—' },
  ];
  return (
    <dl className="stats-strip" aria-label="On-chain totals">
      {stats.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ago(iso: string | null): string {
  if (!iso) return '';
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (Number.isNaN(h)) return '';
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export function NewsRail() {
  const [items, setItems] = useState<NewsPromise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/news', { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'News search is unavailable.');
        setItems(j.items as NewsPromise[]);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ctrl.abort();
  }, []);

  if (error)
    return (
      <p className="rail-note" role="status">
        Couldn’t load this week’s news ({error}). You can still{' '}
        <Link className="text-link" href="/create">
          paste any link
        </Link>
        .
      </p>
    );
  if (!items)
    return (
      <ol className="news-list" aria-busy="true" aria-label="Loading news">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="news-item skeleton">
            <span />
            <span />
          </li>
        ))}
      </ol>
    );
  if (items.length === 0) return <p className="rail-note">No dated promises in the news this week. Check back later.</p>;

  return (
    <ol className="news-list">
      {items.map((n) => (
        <li key={n.url} className="news-item">
          <p className="news-meta">
            <span>{n.source}</span>
            <span>{ago(n.publishedAt)}</span>
          </p>
          <a className="news-title" href={n.url} target="_blank" rel="noreferrer">
            {n.title}
          </a>
          <Link className="news-track" href={`/create?url=${encodeURIComponent(n.url)}`}>
            Track this <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
