'use client';

import { useMarkets } from '@/chain/hooks';
import { MarketCard } from '@/components/kept/ledger';

export default function Council() {
  const { data: markets, error, loading } = useMarkets();
  const pending = (markets ?? []).filter((market) => market.status === 'council' || market.status === 'challenged');
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Public review</p>
        <h1>The council desk.</h1>
        <p>Three council members. Two matching votes. Every decision on record.</p>
      </section>
      {loading && <p role="status">Loading council markets…</p>}
      {error && <p role="alert" className="negative">Could not load council markets: {error.message}</p>}
      {!loading && !error && pending.length === 0 && <p className="muted">No markets are waiting for a council decision.</p>}
      <div className="grid">{pending.map((market) => <MarketCard market={market} key={market.id} />)}</div>
      <p className="muted">Open a market to review the proposal and cast a vote. The program checks that the connected wallet is a configured council member.</p>
    </>
  );
}
