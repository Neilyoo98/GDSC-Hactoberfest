'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useKeptActions, useMarkets, usePositions } from '@/chain/hooks';
import { StatusChip } from '@/components/kept/ledger';
import { ConnectWallet } from '@/wallet/ConnectWallet';

const dateLabel = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function BetsPage() {
  const actions = useKeptActions();
  const owner = actions.wallet?.publicKey.toBase58();
  const { data: positions, error, loading } = usePositions({
    owner,
    enabled: Boolean(owner),
  });
  const { data: markets, error: marketError, loading: marketsLoading } = useMarkets();
  const [claiming, setClaiming] = useState<number | null>(null);
  const marketById = new Map((markets ?? []).map((market) => [market.id, market]));
  const bets = [...(positions ?? [])].sort((a, b) => b.market - a.market);
  const activeCount = bets.filter((bet) => marketById.get(bet.market)?.status === 'open').length;
  const resolvingCount = bets.filter((bet) =>
    ['proposed', 'challenged', 'council'].includes(marketById.get(bet.market)?.status ?? ''),
  ).length;
  const settledCount = bets.filter((bet) =>
    ['finalized', 'void'].includes(marketById.get(bet.market)?.status ?? ''),
  ).length;
  const totalStaked = bets.reduce((sum, bet) => sum + bet.amount, 0);

  async function claim(marketId: number) {
    setClaiming(marketId);
    try {
      await actions.claim(marketId);
    } catch {
      // useKeptActions displays the wallet-aware error toast.
    } finally {
      setClaiming(null);
    }
  }

  if (!owner) {
    return (
      <>
        <section className="masthead">
          <p className="eyebrow">Your wallet record</p>
          <h1>My Bets</h1>
          <p className="masthead-lede">
            Connect a wallet to see the promises you have backed. Switch wallets
            in the Test wallets menu to view a different account.
          </p>
        </section>
        <ConnectWallet />
      </>
    );
  }

  return (
    <>
      <section className="masthead bets-masthead">
        <p className="eyebrow">Your wallet record</p>
        <h1>My Bets</h1>
        <p className="masthead-lede">
          Every promise this wallet has backed, with its current status and
          result.
        </p>
        <p className="bets-wallet mono">Wallet · {owner}</p>
      </section>

      <dl className="stats-strip bets-stats">
        <div><dt>Open</dt><dd>{activeCount}</dd></div>
        <div><dt>Resolving</dt><dd>{resolvingCount}</dd></div>
        <div><dt>Settled</dt><dd>{settledCount}</dd></div>
        <div><dt>Total staked</dt><dd>{totalStaked.toLocaleString('en-US')} tUSDC</dd></div>
      </dl>

      <section aria-labelledby="bets-heading">
        <h2 id="bets-heading" className="section-title">Your predictions</h2>
        {(loading || marketsLoading) && <p role="status" className="ledger-empty">Loading your bets…</p>}
        {error && <p role="alert" className="negative">Couldn’t load this wallet’s bets: {error.message}</p>}
        {marketError && <p role="alert" className="negative">Couldn’t load promise details: {marketError.message}</p>}
        {!loading && !marketsLoading && !error && !marketError && bets.length === 0 && (
          <div className="empty" role="status">
            <p>This wallet hasn’t backed a promise yet.</p>
            <Link className="text-link" href="/">Browse promises →</Link>
          </div>
        )}
        {!error && !marketError && bets.length > 0 && (
          <ul className="ledger bets-ledger">
            {bets.map((bet) => {
              const market = marketById.get(bet.market);
              const settled = market?.status === 'finalized' || market?.status === 'void';
              const won = market?.final === bet.side;
              const result = market?.status === 'void'
                ? 'Refund available'
                : market?.final
                  ? won ? 'Correct prediction' : 'Incorrect prediction'
                  : 'Awaiting result';
              return (
                <li className="ledger-row bet-row" key={`${bet.market}-${bet.owner}`}>
                  <div className="ledger-main">
                    <p className="ledger-meta">
                      {market?.promiser ?? `Market ${bet.market}`}
                      {market && <StatusChip status={market.status} />}
                    </p>
                    <Link href={`/markets/${bet.market}`} className="ledger-quote">
                      “{market?.promiseText ?? 'Promise details are unavailable.'}”
                    </Link>
                    <p className="bet-position">
                      <span className={`bet-side bet-side-${bet.side}`}>
                        {bet.side === 'kept' ? '✓ BACKED KEPT' : '✕ BACKED BROKEN'}
                      </span>
                      <span className="bet-amount">{bet.amount} tUSDC staked</span>
                    </p>
                    {market && (
                      <p className="ledger-deadline">Deadline · {dateLabel(market.deadline)}</p>
                    )}
                  </div>
                  <div className="bet-summary">
                    <p className={`bet-result ${market?.final ?? 'pending'}`}>{result}</p>
                    <p className="bet-claim-state">
                      {bet.claimed
                        ? 'Claimed'
                        : settled
                          ? 'Payout or refund ready'
                          : 'No payout available yet'}
                    </p>
                    {settled && !bet.claimed && (
                      <button
                        type="button"
                        className="primary bet-claim-button"
                        disabled={claiming === bet.market}
                        onClick={() => void claim(bet.market)}
                      >
                        {claiming === bet.market ? 'Claiming…' : 'Claim payout / refund'}
                      </button>
                    )}
                    <Link className="text-link bet-view-link" href={`/markets/${bet.market}`}>
                      View promise →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
