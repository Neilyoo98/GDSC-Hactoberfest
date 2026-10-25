'use client';
// OWNER: P3
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MarketView, Outcome, Side } from '@/shared/types';
import { useMarkets, useKeptActions, usePositions } from '@/chain/hooks';
import { ConnectWallet } from '@/wallet/ConnectWallet';

const handleFor = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${status.toLowerCase()}`}>● {status}</span>;
}
export function OddsBar({ market }: { market: MarketView }) {
  const total = market.totals.kept + market.totals.broken;
  const odds = total ? Math.round((market.totals.kept / total) * 100) : 50;
  return (
    <div aria-live="polite">
      <div className="odds-label">
        <span className="positive">✓ Kept {odds}% · {market.totals.kept} tUSDC</span>
        <span className="negative">✕ Broken {100 - odds}% · {market.totals.broken} tUSDC</span>
      </div>
      <div className="odds">
        <span style={{ width: `${odds}%` }} />
      </div>
    </div>
  );
}
export function MarketCard({ market }: { market: MarketView }) {
  const handle = handleFor(market.promiser);
  return (
    <article className="market-card">
      <div className="row card-heading">
        <Link href={`/promisers/${handle}`} className="promiser">
          {market.promiser}
        </Link>
        <StatusChip status={market.status} />
      </div>
      <Link href={`/markets/${market.id}`} className="quote">
        “{market.promiseText}”
      </Link>
      <p className="deadline">Deadline · {new Date(market.deadline * 1000).toLocaleDateString()}</p>
      <OddsBar market={market} />
    </article>
  );
}
export function MarketGrid() {
  const [filter, setFilter] = useState('All promises');
  const { data: markets, error, loading } = useMarkets();
  const filtered = (markets ?? []).filter((m) =>
    filter === 'All promises' ||
    (filter === 'Resolving'
      ? ['proposed', 'challenged', 'council'].includes(m.status)
      : filter === 'Settled'
        ? ['finalized', 'void'].includes(m.status)
        : m.status === 'open'),
  );
  return (
    <>
      <div className="filter-row">
        <label className="sr-only" htmlFor="promise-filter">
          Filter promises
        </label>
        <select
          id="promise-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {['All promises', 'Open', 'Resolving', 'Settled'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {loading && <p role="status">Loading on-chain promises…</p>}
      {error && <p role="alert" className="negative">Could not load promises: {error.message}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="muted">No promises match this filter yet.</p>
      )}
      <div className="grid">
        {filtered.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </>
  );
}
export function StakePanel({ market }: { market: MarketView }) {
  const [side, setSide] = useState<Side>('kept');
  const [amount, setAmount] = useState(10);
  const [outcome, setOutcome] = useState<Outcome>('kept');
  const [now, setNow] = useState(0);
  const actions = useKeptActions();
  const owner = actions.wallet?.publicKey.toBase58();
  const { data: positions = [], loading: positionsLoading } = usePositions({ owner, market: market.id });
  const position = positions.find((item) => item.owner === owner);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    const update = () => setNow(Date.now() / 1000);
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [market.id]);
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 100;
  const pool = market.totals.kept + market.totals.broken;
  const winning = side === 'kept' ? market.totals.kept : market.totals.broken;
  const busy = working || positionsLoading;

  async function perform(action: () => Promise<unknown>) {
    setWorking(true);
    try { await action(); }
    catch { /* useKeptActions displays a wallet-aware toast */ }
    finally { setWorking(false); }
  }

  return (
    <aside className="panel">
      <p className="eyebrow">Your prediction</p>
      {!actions.wallet && <ConnectWallet />}
      {market.status === 'open' ? (
        <>
          <div className="choices">
            {['kept', 'broken'].map((s) => (
              <button
                key={s}
                aria-pressed={side === s}
                onClick={() => setSide(s as Side)}
              >
                {s === 'kept' ? '✓ Kept' : '✕ Broken'}
              </button>
            ))}
          </div>
          <label>
            Amount · tUSDC
            <input
              type="number"
              min="1"
              max="100"
              value={amount}
              onChange={(e) => setAmount(e.target.valueAsNumber)}
            />
          </label>
          <small>1–100 tUSDC · One prediction per wallet</small>
          {valid ? (
            <p>
              Estimated return if correct{' '}
              <strong className="amount">
                {((amount * (pool + amount)) / (winning + amount)).toFixed(2)}{' '}
                <small>tUSDC</small>
              </strong>
            </p>
          ) : (
            <p role="alert">Enter an amount from 1 to 100.</p>
          )}
          <button className="primary" disabled={!actions.wallet || !valid || busy || Boolean(position)}
            onClick={() => void perform(() => actions.stake(market.id, side, amount))}>
              {position ? `Your ${position.side} prediction · ${position.amount} tUSDC` : busy ? 'Waiting for confirmation…' : 'Confirm prediction'}
          </button>
          {position && <p className="muted">One prediction per wallet on each market.</p>}
        </>
      ) : (
        <>
          <h2>
            {market.status === 'proposed'
              ? 'AI proposal pending review'
              : market.status === 'council' || market.status === 'challenged'
                ? 'Council reviewing'
                : market.status === 'finalized'
                  ? `Final result · ${market.final}`
                  : market.status === 'void'
                    ? 'Market void · positions are refundable'
                    : 'Prediction closed'}
          </h2>
          {market.proposal && <p>{market.proposal.summary}</p>}
          {market.status === 'proposed' && market.proposal && (
            <>
              <p className="muted">Challenge window ends {new Date(market.proposal.windowEndsAt * 1000).toLocaleString()}.</p>
              <button disabled={!actions.wallet || !position || busy || now >= market.proposal.windowEndsAt}
                onClick={() => void perform(() => actions.challenge(market.id))}>
                {position ? 'Challenge proposal · 10 tUSDC' : 'A position is required to challenge'}
              </button>
              {now >= market.proposal.windowEndsAt && (
                <button className="primary" disabled={!actions.wallet || busy}
                  onClick={() => void perform(() => actions.finalize(market.id))}>Finalize result</button>
              )}
            </>
          )}
          {(market.status === 'council' || market.status === 'challenged') && (
            <>
              <label>Vote on the outcome
                <select value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)}>
                  <option value="kept">Kept</option><option value="broken">Broken</option><option value="void">Void</option>
                </select>
              </label>
              <button disabled={!actions.wallet || busy} onClick={() => void perform(() => actions.councilVote(market.id, outcome))}>Cast council vote</button>
              <p className="muted">Only configured council wallets can vote; the program checks membership.</p>
            </>
          )}
          {(market.status === 'finalized' || market.status === 'void') && (
            <button className="primary" disabled={!actions.wallet || !position || position.claimed || busy}
              onClick={() => void perform(() => actions.claim(market.id))}>
              {!position ? 'No position to claim' : position.claimed ? 'Already claimed' : market.status === 'void' ? 'Claim refund' : `Claim ${position.side} position`}
            </button>
          )}
        </>
      )}
      <Link className="text-link" href="/faucet">
        Get test tokens ↗
      </Link>
    </aside>
  );
}
