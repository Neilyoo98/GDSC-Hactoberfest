'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMarkets } from '@/chain/hooks';
import { MarketCard } from '@/components/kept/ledger';

export default function Promiser() {
  const { handle } = useParams<{ handle: string }>();
  const { data: markets, error, loading } = useMarkets();
  const records = (markets ?? []).filter((market) =>
    market.promiser.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') === handle,
  );
  if (loading) return <p role="status">Loading public record…</p>;
  if (error) return <p role="alert" className="negative">Could not load this public record: {error.message}</p>;
  if (!records.length) return <section><h1>No public record found</h1><Link href="/">← All promises</Link></section>;
  const settled = records.filter((market) => market.status === 'finalized' || market.status === 'void');
  const kept = settled.filter((market) => market.final === 'kept').length;
  const broken = settled.filter((market) => market.final === 'broken').length;
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Public record · Solana devnet</p>
        <h1>{records[0].promiser}</h1>
        <p>{records.length} commitments · Kept {kept} · Broken {broken} · {records.length - settled.length} pending</p>
      </section>
      <div className="grid">{records.map((market) => <MarketCard key={market.id} market={market} />)}</div>
    </>
  );
}
