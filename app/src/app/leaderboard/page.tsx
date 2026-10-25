'use client';

import Link from 'next/link';
import { useKeptActions, useMarkets, usePositions } from '@/chain/hooks';
import { ConnectWallet } from '@/wallet/ConnectWallet';

export default function Leaderboard() {
  const actions = useKeptActions();
  const owner = actions.wallet?.publicKey.toBase58();
  const { data: positions, error, loading } = usePositions(owner ? { owner } : undefined);
  const { data: markets } = useMarkets();
  if (!owner) return (
    <>
      <section className="hero compact"><p className="eyebrow">The forecaster record</p><h1>Good judgment adds up.</h1><p>Connect a wallet to see its predictions and results.</p></section>
      <ConnectWallet />
    </>
  );
  const marketById = new Map((markets ?? []).map((market) => [market.id, market]));
  const resolved = (positions ?? []).filter((position) => {
    const market = marketById.get(position.market);
    return market?.status === 'finalized';
  });
  const correct = resolved.filter((position) => {
    const market = marketById.get(position.market);
    return market?.final === position.side;
  }).length;
  return (
    <>
      <section className="hero compact"><p className="eyebrow">Your forecaster record</p><h1>Good judgment adds up.</h1><p>On-chain predictions for <code>{owner}</code></p></section>
      {loading && <p role="status">Loading your positions…</p>}
      {error && <p role="alert" className="negative">Could not load positions: {error.message}</p>}
      <section className="panel">
        <h2>{resolved.length ? `${correct}/${resolved.length} correct` : 'No settled predictions yet'}</h2>
        <p className="muted">{positions?.length ?? 0} total prediction(s) · accuracy uses resolved Kept/Broken markets; void markets are excluded.</p>
        <ul>{(positions ?? []).map((position) => {
          const market = marketById.get(position.market);
          return <li key={`${position.market}-${position.owner}`}><Link href={`/markets/${position.market}`}>{market?.promiser ?? `Market ${position.market}`} · {position.side} {position.amount} tUSDC {market?.final ? `· result ${market.final}` : '· pending'}</Link></li>;
        })}</ul>
      </section>
    </>
  );
}
